# AutoEstudioCR Detailing

Sitio web informativo y responsivo para AutoEstudioCR. Presenta el catálogo oficial, proyectos reales y opiniones públicas de Google. Las consultas, cotizaciones y coordinación de servicios se realizan exclusivamente por WhatsApp.

## Alcance

La aplicación no ofrece cuentas de cliente, registro de vehículos, carrito, pagos ni reservaciones en línea. Tampoco publica precios: cada vehículo se valora según tamaño, condición y servicio solicitado.

Incluye:

- catálogo alimentado únicamente desde `services.json`;
- paquetes y servicios adicionales sin precios;
- enlaces contextuales a WhatsApp para cada servicio;
- portafolio público con fotografías y videos;
- panel privado para publicar proyectos;
- opiniones obtenidas mediante Places API (New);
- metadatos SEO, `robots.txt` y `sitemap.xml`;
- despliegue automatizado en Cloud Run.

El catálogo comercial se organiza en **Lavado Básico**, **Detallado Básico**, **Detallado Premium** y **Paquete Cerámico**, seguido por una sección independiente con nueve servicios adicionales. El paquete cerámico ofrece recubrimientos de 1 a 5 años según la elección y valoración del cliente.

El encabezado utiliza `public/autoestudiocr-header-logo.svg`, que conserva dentro de un contenedor SVG textual la imagen horizontal oficial proporcionada. El pie de página mantiene `public/autoestudiocr-logo.svg`.

## Desarrollo

```bash
npm ci
npm run dev
```

Validaciones:

```bash
npm run lint
npm test
npm run build
```

## Datos persistentes

Firestore conserva solamente los documentos de `projects`; Cloud Storage conserva las fotografías y videos bajo:

```text
projects/{projectId}/photos/
projects/{projectId}/videos/
```

El bucket permanece privado y el servidor entrega los medios mediante endpoints controlados. La aplicación ya no utiliza Firebase Authentication ni colecciones de usuarios, vehículos, reservaciones, pagos, gastos, promociones o fechas bloqueadas.

Prepara los recursos una sola vez:

```bash
export PROJECT_ID="tu-id-de-proyecto"
export REGION="us-west1"
./GCP-infra/storage/setup.sh
```

Para borrar deliberadamente el portafolio de prueba y cualquier dato heredado de la versión con cuentas y reservaciones:

```bash
./GCP-infra/storage/setup.sh --hard-reset
```

## Administración

El botón **Administrar** abre un acceso privado destinado únicamente a publicar proyectos. Configura la contraseña y el secreto de sesión con Secret Manager:

```bash
export PROJECT_ID="tu-id-de-proyecto"
read -s ADMIN_PASSWORD; export ADMIN_PASSWORD
export SESSION_SECRET="$(openssl rand -hex 32)"
./GCP-infra/configure-admin.sh
unset ADMIN_PASSWORD SESSION_SECRET
```

No uses la contraseña inicial en producción.

## Google Analytics 4 y página de conversión

La ruta pública `/gracias` está preparada como página de confirmación y devuelve `noindex,nofollow`. Actualmente el sitio no tiene un formulario comercial: abrir WhatsApp no redirige a esa ruta ni genera una visita falsa a la página de conversión.

Para revisarla localmente ejecuta `npm run dev` y abre `http://localhost:5173/gracias`. Para validar la respuesta de producción usa `npm run build`, inicia `PORT=8080 npm start` y confirma con `curl -s http://localhost:8080/gracias | grep noindex,nofollow`.

Todos los enlaces a WhatsApp emiten el evento GA4 `whatsapp_contact` con `page_location`, `button_location` y `contact_method`. Para enviarlo a una propiedad real necesitas crear un flujo web en GA4 y configurar su ID de medición `G-XXXXXXXXXX`:

```bash
# Desarrollo local
printf 'VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"\n' > .env.local
npm run dev
```

En Cloud Build agrega la sustitución `_GA_MEASUREMENT_ID` al trigger con ese mismo valor. El Dockerfile lo incorpora al bundle durante la compilación; el ID es público y no debe guardarse en Secret Manager. Para probar DebugView abre `http://localhost:5173/?debug_analytics=1`, pulsa cualquier enlace de WhatsApp y busca `whatsapp_contact` en GA4.

## Google Reviews

La interfaz consulta `/api/reviews`. La API key permanece en Secret Manager y nunca se envía al navegador:

```bash
export PROJECT_ID="tu-id-de-proyecto"
export GOOGLE_PLACE_ID="ChIJ..."
read -s GOOGLE_MAPS_API_KEY; export GOOGLE_MAPS_API_KEY
./GCP-infra/configure-google-reviews.sh
unset GOOGLE_MAPS_API_KEY
```

El servidor conserva la respuesta durante una hora. Si Google no devuelve información, la página no inventa calificaciones.

## Cloud Run y despliegue continuo

```bash
export PROJECT_ID="tu-id-de-proyecto"
export REGION="us-west1"
./GCP-infra/storage/setup.sh
./GCP-infra/deploy.sh
./GCP-infra/configure-admin.sh
./GCP-infra/configure-google-reviews.sh
```

Después de autorizar GitHub en Cloud Build:

```bash
./GCP-infra/create-trigger.sh
```

Cada merge a `main` ejecuta tests dentro del Docker build, publica una imagen etiquetada con el SHA y despliega una revisión nueva. Consulta [`GCP-infra/README.md`](GCP-infra/README.md) para la guía operativa.

## Seguridad

- No guardes API keys, contraseñas o tokens en Git.
- Usa una contraseña administrativa única y un `SESSION_SECRET` aleatorio.
- Mantén el bucket con prevención de acceso público.
- El navegador no accede directamente a Firestore ni Storage.
