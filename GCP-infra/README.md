# Infraestructura de AutoEstudioCR

La arquitectura actual es deliberadamente pequeña: Cloud Run sirve el sitio y la API; Firestore conserva únicamente metadata del portafolio; Cloud Storage conserva fotos y videos; Secret Manager protege el acceso administrativo y la clave de Google Places.

```text
GitHub → Cloud Build → Artifact Registry → Cloud Run
                                         ├── Places API (reseñas)
                                         ├── Firestore (projects)
                                         └── Cloud Storage (media)
```

No se utilizan cuentas de cliente, Firebase Authentication, Google Calendar, reservaciones, pagos ni notificaciones automáticas.

## Preparación inicial

Requisitos: proyecto de GCP con facturación activa, `gcloud` autenticado y permisos para administrar APIs, IAM, Cloud Run, Firestore, Storage y Secret Manager.

```bash
gcloud auth login
export PROJECT_ID="tu-id-de-proyecto"
export REGION="us-west1"
./GCP-infra/storage/setup.sh
./GCP-infra/deploy.sh
```

`storage/setup.sh` crea Firestore Native, un bucket privado, su ciclo de vida, permisos mínimos y prefijos iniciales. `deploy.sh` habilita las APIs de ejecución, crea `estudio-auto-calendar`, prepara Artifact Registry y ejecuta Cloud Build.

## Acceso administrativo

El administrador solo puede publicar proyectos. Guarda la contraseña y la firma de sesión como secretos:

```bash
read -s ADMIN_PASSWORD; export ADMIN_PASSWORD
export SESSION_SECRET="$(openssl rand -hex 32)"
./GCP-infra/configure-admin.sh
unset ADMIN_PASSWORD SESSION_SECRET
```

El script crea nuevas versiones de `autoestudio-admin-password` y `autoestudio-session-secret`, concede acceso a `estudio-auto-calendar` y actualiza Cloud Run.

## Google Reviews

Necesitas el Place ID del perfil y una API key restringida exclusivamente a Places API (New):

```bash
export GOOGLE_PLACE_ID="ChIJ_REEMPLAZAR"
read -s GOOGLE_MAPS_API_KEY; export GOOGLE_MAPS_API_KEY
export PUBLIC_SITE_URL="https://tu-dominio.cr" # opcional
./GCP-infra/configure-google-reviews.sh
unset GOOGLE_MAPS_API_KEY
```

Verifica:

```bash
SERVICE_URL="$(gcloud run services describe proyectocardetailing --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
curl -s "$SERVICE_URL/api/reviews"
```

La respuesta contiene `rating`, `total`, `reviews` y `googleMapsUrl`. El servidor utiliza caché de una hora.

## Portafolio

Los proyectos se publican desde **Administrar → Publicar proyecto**. Firestore guarda título, descripción, fecha y metadata; Storage usa:

```text
projects/{projectId}/photos/
projects/{projectId}/videos/
```

También se pueden añadir archivos directamente a esos prefijos; el endpoint público sincroniza el contenido de Storage para proyectos que ya tengan documento en Firestore.

Para borrar el portafolio de prueba:

```bash
./GCP-infra/storage/setup.sh --hard-reset
```

Sin el flag, el script nunca borra datos.

## Trigger de GitHub

Primero vincula `JosueArce/proyectocardetailing` en **Cloud Build → Repositories**. Después:

```bash
./GCP-infra/create-trigger.sh
```

El script crea las cuentas `estudio-auto-builder` y `estudio-auto-calendar`, asigna los permisos del pipeline y crea `deploy-main-cloud-run` para `^main$`. Cada imagen utiliza `$COMMIT_SHA`.

## Diagnóstico

```bash
gcloud builds list --project="$PROJECT_ID" --limit=10
gcloud run services describe proyectocardetailing --region="$REGION" --project="$PROJECT_ID"
gcloud run services logs read proyectocardetailing --region="$REGION" --project="$PROJECT_ID" --limit=100
curl -fsS "$SERVICE_URL/health"
```

Cloud Run debe escuchar el `PORT` inyectado. El Dockerfile prueba `/health` y el logo antes de producir la imagen final.

## Cambiar a otro proyecto de GCP

Los scripts aceptan `PROJECT_ID` y son idempotentes. En un proyecto nuevo ejecuta, en orden:

1. `storage/setup.sh`;
2. `deploy.sh`;
3. `configure-admin.sh`;
4. `configure-google-reviews.sh`;
5. autoriza GitHub y ejecuta `create-trigger.sh`.

Los secretos y datos no se copian automáticamente. Para conservar proyectos existentes se debe exportar Firestore y copiar los objetos del bucket por separado.
