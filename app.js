// CONFIGURACIÓN: pega aquí la URL pública de tu Cloudflare Worker.
// El Worker debe aceptar multipart/form-data con los campos:
// personImage, garmentImage y quality. Debe responder JSON con { "image": "https://..." }
// o { "image": "data:image/png;base64,..." }.
// No coloques aquí tu API key de FASHN: debe permanecer como secreto en Cloudflare.
const API_URL = "PEGA_AQUI_LA_URL_DE_TU_CLOUDFLARE_WORKER";

const $ = (id) => document.getElementById(id);
const state = { person: null, garment: null, resultUrl: null, quality: "standard" };

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function loadImage(file, type) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showToast("Elige una imagen JPG, PNG o WEBP.");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast("La imagen supera el límite de 12 MB.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state[type] = { file, dataUrl: reader.result };
    const prefix = type === "person" ? "person" : "garment";
    $(prefix + "Preview").src = reader.result;
    $(prefix + "Preview").hidden = false;
    $(prefix + "Placeholder").hidden = true;
    $(prefix + "Change").hidden = false;
    updateGenerateButton();
  };
  reader.readAsDataURL(file);
}

function updateGenerateButton() {
  $("generateBtn").disabled = !(state.person && state.garment);
}

$("personInput").addEventListener("change", e => loadImage(e.target.files[0], "person"));
$("garmentInput").addEventListener("change", e => loadImage(e.target.files[0], "garment"));

function enableDropzone(zoneId, inputId, type) {
  const zone = $(zoneId);
  ["dragenter", "dragover"].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault(); zone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault(); zone.classList.remove("dragover");
  }));
  zone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file, type);
  });
}
enableDropzone("personDrop", "personInput", "person");
enableDropzone("garmentDrop", "garmentInput", "garment");

document.querySelectorAll(".quality-option").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".quality-option").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.quality = btn.dataset.quality;
  });
});

function setResult(src) {
  if (state.resultUrl && state.resultUrl.startsWith("blob:")) URL.revokeObjectURL(state.resultUrl);
  state.resultUrl = src;
  $("resultImage").src = src;
  $("modalImage").src = src;
  $("emptyResult").hidden = true;
  $("loadingState").hidden = true;
  $("resultImageWrap").hidden = false;
  $("viewBtn").disabled = false;
  $("downloadBtn").disabled = false;
  $("resultHint").innerHTML = '<span>✦</span> ¡Tu look está listo!';
}

async function generateLook() {
  if (!state.person || !state.garment) return;
  if (!API_URL || API_URL.includes("PEGA_AQUI")) {
    showToast("Primero conecta la URL de tu Cloudflare Worker en app.js.");
    $("configNote").textContent = "Falta configurar API_URL en app.js para activar la generación real con IA.";
    return;
  }
  $("generateBtn").disabled = true;
  $("generateText").textContent = "Creando tu look...";
  $("emptyResult").hidden = true;
  $("resultImageWrap").hidden = true;
  $("loadingState").hidden = false;
  $("resultHint").textContent = "Procesando tus fotografías...";
  try {
    const formData = new FormData();
    formData.append("personImage", state.person.file, state.person.file.name);
    formData.append("garmentImage", state.garment.file, state.garment.file.name);
    formData.append("quality", state.quality);
    const response = await fetch(API_URL, { method: "POST", body: formData });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || `Error ${response.status}`);
    }
    const data = await response.json();
    const image = data.image || data.result || data.output || data.url;
    if (!image) throw new Error("El Worker respondió, pero no devolvió una imagen. Revisa el formato de respuesta.");
    setResult(image);
    $("configNote").textContent = "Generación conectada correctamente.";
  } catch (error) {
    $("loadingState").hidden = true;
    $("emptyResult").hidden = false;
    $("resultHint").textContent = "No se pudo generar el resultado.";
    showToast(error.message || "Ocurrió un error al generar la imagen.");
  } finally {
    $("generateBtn").disabled = false;
    $("generateText").textContent = "Crear mi look";
    updateGenerateButton();
  }
}
$("generateBtn").addEventListener("click", generateLook);

function openModal() {
  if (!state.resultUrl) return;
  $("modalImage").src = state.resultUrl;
  $("imageModal").classList.add("open");
  $("imageModal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("imageModal").classList.remove("open");
  $("imageModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
$("expandBtn").addEventListener("click", openModal);
$("viewBtn").addEventListener("click", openModal);
$("modalClose").addEventListener("click", closeModal);
$("modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

async function downloadResult() {
  if (!state.resultUrl) {
    showToast("Primero genera tu look para poder descargarlo.");
    return;
  }

  const buttons = [$("downloadBtn"), $("modalDownload")];
  buttons.forEach(button => {
    button.disabled = true;
    if (button.id === "downloadBtn") button.textContent = "Preparando...";
    else button.textContent = "Preparando descarga...";
  });

  try {
    // Fetch convierte tanto Data URLs como imágenes alojadas en el Worker
    // en un Blob local. Así el navegador puede descargar el archivo
    // aunque la imagen venga desde otro dominio (si el servidor permite CORS).
    const response = await fetch(state.resultUrl);
    if (!response.ok) throw new Error(`No se pudo obtener la imagen (${response.status}).`);

    const blob = await response.blob();
    if (!blob.size) throw new Error("La imagen recibida está vacía.");

    const mime = blob.type || "image/png";
    const extension = mime.includes("jpeg") ? "jpg"
      : mime.includes("webp") ? "webp"
      : mime.includes("png") ? "png" : "png";

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `mi-look-virtual.${extension}`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Se revoca después de que el navegador haya iniciado la descarga.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    showToast("¡Tu imagen se está descargando!");
  } catch (error) {
    console.error("Error al descargar el resultado:", error);
    // Si el servidor remoto bloquea CORS, se ofrece abrir la imagen
    // en una pestaña para que el usuario pueda guardarla manualmente.
    try {
      const opened = window.open(state.resultUrl, "_blank", "noopener");
      if (opened) {
        showToast("La imagen se abrió en otra pestaña. Usa Guardar imagen como.");
      } else {
        showToast("El servidor bloqueó la descarga. Revisa los permisos CORS del Worker.");
      }
    } catch (_) {
      showToast("No se pudo descargar. Revisa los permisos CORS del Worker.");
    }
  } finally {
    buttons.forEach(button => {
      button.disabled = false;
      if (button.id === "downloadBtn") button.textContent = "↓ Descargar";
      else button.textContent = "↓ Descargar imagen";
    });
  }
}
$("downloadBtn").addEventListener("click", downloadResult);
$("modalDownload").addEventListener("click", downloadResult);

if (API_URL.includes("PEGA_AQUI")) {
  $("configNote").textContent = "Vista lista. Para probar ropa con IA real, conecta tu Cloudflare Worker en app.js.";
}
