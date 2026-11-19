
// ==========================================
// ATELIER - PROBADOR VIRTUAL CON FASHN AI
// ==========================================

const API_URL = "https://vertice-api.k71559676.workers.dev";

const $ = (id) => document.getElementById(id);

const state = {
  person: null,
  garment: null,
  resultUrl: null,
  quality: "standard"
};

// ==========================================
// MENSAJES
// ==========================================

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

// ==========================================
// CARGAR FOTOGRAFÍAS
// ==========================================

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
    state[type] = {
      file,
      dataUrl: reader.result
    };

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

$("personInput").addEventListener("change", e => {
  loadImage(e.target.files[0], "person");
});

$("garmentInput").addEventListener("change", e => {
  loadImage(e.target.files[0], "garment");
});

// ==========================================
// ARRASTRAR Y SOLTAR IMÁGENES
// ==========================================

function enableDropzone(zoneId, inputId, type) {
  const zone = $(zoneId);

  ["dragenter", "dragover"].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    zone.addEventListener(evt, e => {
      e.preventDefault();
      zone.classList.remove("dragover");
    });
  });

  zone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];

    if (file) loadImage(file, type);
  });
}

enableDropzone("personDrop", "personInput", "person");
enableDropzone("garmentDrop", "garmentInput", "garment");

// ==========================================
// CALIDAD DE IMAGEN
// ==========================================

document.querySelectorAll(".quality-option").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".quality-option").forEach(b => {
      b.classList.remove("active");
    });

    btn.classList.add("active");
    state.quality = btn.dataset.quality;
  });
});

// ==========================================
// MOSTRAR RESULTADO
// ==========================================

function setResult(src) {
  if (state.resultUrl && state.resultUrl.startsWith("blob:")) {
    URL.revokeObjectURL(state.resultUrl);
  }

  state.resultUrl = src;

  $("resultImage").src = src;
  $("modalImage").src = src;

  $("emptyResult").hidden = true;
  $("loadingState").hidden = true;
  $("resultImageWrap").hidden = false;

  $("viewBtn").disabled = false;
  $("downloadBtn").disabled = false;

  $("resultHint").innerHTML = "✦ ¡Tu look está listo!";
}

// ==========================================
// CONECTAR CON FASHN AI
// ==========================================

async function generateLook() {

  if (!state.person || !state.garment) {
    showToast("Sube las dos fotografías antes de continuar.");
    return;
  }

  $("generateBtn").disabled = true;
  $("generateText").textContent = "Enviando a la IA...";

  $("emptyResult").hidden = true;
  $("resultImageWrap").hidden = true;
  $("loadingState").hidden = false;

  $("resultHint").textContent = "Conectando con FASHN AI...";

  try {

    const response = await fetch(`${API_URL}/api/tryon`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        // Nombres que espera tu Worker
        model_image: state.person.dataUrl,
        garment_image: state.garment.dataUrl,

        category: "auto",
        garment_photo_type: "auto",

        mode: state.quality === "high"
          ? "quality"
          : "balanced"

      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {

      const detail =
        data.details?.message ||
        data.details?.error ||
        data.details?.detail;

      throw new Error(
        detail || data.error || `Error ${response.status}`
      );
    }

    if (!data.id) {
      throw new Error(
        data.error || "El Worker no devolvió el identificador."
      );
    }

    $("generateText").textContent = "La IA está trabajando...";

    $("resultHint").textContent =
      "Solicitud recibida. Generando tu look...";

    await pollGeneration(data.id);

  } catch (error) {

    console.error("ATELIER / FASHN:", error);

    $("loadingState").hidden = true;
    $("emptyResult").hidden = false;

    $("resultHint").textContent =
      "No se pudo generar el resultado.";

    showToast(error.message || "Error al generar la imagen.");

  } finally {

    $("generateBtn").disabled = false;
    $("generateText").textContent = "Crear mi look";

    updateGenerateButton();
  }
}

// ==========================================
// CONSULTAR RESULTADO DE FASHN
// ==========================================

async function pollGeneration(predictionId) {

  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {

    await new Promise(resolve => setTimeout(resolve, 2500));

    const response = await fetch(
      `${API_URL}/api/status?id=${encodeURIComponent(predictionId)}`
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {

      const detail =
        data.details?.message ||
        data.details?.error ||
        data.details?.detail;

      throw new Error(
        detail || data.error ||
        `Error consultando el estado (${response.status}).`
      );
    }

    if (data.status === "completed") {

      const image = Array.isArray(data.output)
        ? data.output[0]
        : null;

      if (!image) {
        throw new Error(
          "FASHN terminó, pero no devolvió una imagen."
        );
      }

      setResult(image);

      $("resultHint").innerHTML =
        "✦ ¡Tu look está listo!";

      $("configNote").textContent =
        "Conectado con FASHN AI · Generación completada.";

      showToast("¡Tu prueba virtual está lista!");

      return;
    }

    if (data.status === "failed") {

      const message = typeof data.error === "string"
        ? data.error
        : data.error?.message;

      throw new Error(
        message || "FASHN no pudo generar esta imagen."
      );
    }

    $("resultHint").textContent =
      `La IA está procesando tu look · ${data.status || "en espera"}`;
  }

  throw new Error(
    "La generación está tardando demasiado. Inténtalo nuevamente."
  );
}

$("generateBtn").addEventListener("click", generateLook);

// ==========================================
// AMPLIAR RESULTADO
// ==========================================

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

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// ==========================================
// DESCARGAR RESULTADO
// ==========================================

async function downloadResult() {

  if (!state.resultUrl) {
    showToast("Primero genera tu look.");
    return;
  }

  try {

    const response = await fetch(state.resultUrl);

    if (!response.ok) {
      throw new Error("No se pudo obtener la imagen.");
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error("La imagen está vacía.");
    }

    const mime = blob.type || "image/png";

    const extension = mime.includes("jpeg")
      ? "jpg"
      : mime.includes("webp")
      ? "webp"
      : "png";

    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = `mi-look-virtual.${extension}`;

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 1500);

    showToast("¡Tu imagen se está descargando!");

  } catch (error) {

    console.error("Error de descarga:", error);

    window.open(state.resultUrl, "_blank");

    showToast(
      "Si no se descarga, guarda la imagen desde la nueva pestaña."
    );
  }
}

$("downloadBtn").addEventListener("click", downloadResult);
$("modalDownload").addEventListener("click", downloadResult);

// ==========================================
// CONFIGURACIÓN
// ==========================================

$("configNote").textContent =
  "Conexión preparada con tu Cloudflare Worker.";
