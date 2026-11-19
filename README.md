# Atelier — Probador virtual con IA

## Qué incluye
- Carga de foto de la persona y foto de la prenda.
- Vista previa de ambas imágenes.
- Arrastrar y soltar archivos.
- Validación de formato y tamaño (12 MB).
- Selector de calidad visual.
- Panel de resultado, vista ampliada y descarga.
- Diseño responsive para escritorio, tablet y móvil.

## Abrir
Abre `index.html` en tu navegador o publica la carpeta en GitHub Pages.

## Activar generación real con FASHN AI
La interfaz está preparada para comunicarse con tu Cloudflare Worker. La clave de FASHN debe guardarse como secreto en Cloudflare, nunca en el navegador.

1. Abre `app.js`.
2. Reemplaza `PEGA_AQUI_LA_URL_DE_TU_CLOUDFLARE_WORKER` por la URL de tu Worker.
3. Asegúrate de que el Worker reciba `multipart/form-data` con:
   - `personImage`: fotografía de la persona.
   - `garmentImage`: fotografía de la prenda.
   - `quality`: `standard` o `high`.
4. El Worker debe responder JSON con una propiedad `image` que contenga una URL pública o un Data URL de la imagen generada.

**Importante:** este paquete implementa la experiencia visual y la carga/preview/descarga. La generación de prueba virtual real depende de conectar el Worker con FASHN AI y adaptar el contrato de respuesta si tu Worker usa otros nombres de campos.


## Descarga de la imagen
El botón de descarga ahora obtiene la imagen generada como Blob y la guarda como `mi-look-virtual.png` (o JPG/WEBP según el formato recibido). Si la imagen está alojada en otro dominio, el Worker debe permitir CORS para el dominio donde publiques la web. Si el navegador no puede leer la imagen por CORS, se abrirá en otra pestaña para guardarla manualmente.
