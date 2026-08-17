# Despliegue en Google Cloud Run

La raíz del proyecto contiene el `Dockerfile` multi-stage que Cloud Run detecta automáticamente. Esta carpeta contiene la configuración de Nginx, el pipeline de Cloud Build y el script de despliegue. Cloud Run solo recibe los archivos estáticos compilados; las herramientas de Node no quedan en la imagen final.

> **Alcance del prototipo:** las citas se guardan en el `localStorage` del navegador. El despliegue permite probar la experiencia visual, pero las reservas no se comparten entre dispositivos. Para producción se necesita una API, una base de datos y autenticación para el panel.

## Opción 1: desplegar desde la terminal

Requisitos: un proyecto de GCP con facturación activa, [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) y permisos de propietario o equivalentes.

```bash
gcloud auth login
gcloud auth application-default login
export PROJECT_ID="tu-id-de-proyecto"
./GCP-infra/deploy.sh
```

El script habilita Cloud Run, Cloud Build y Artifact Registry; crea el repositorio Docker si todavía no existe; ejecuta los tests dentro del build; construye la imagen; y muestra la URL pública al finalizar.

También puedes desplegar directamente desde el código fuente. Cloud Build detectará el `Dockerfile` de la raíz:

```bash
gcloud run deploy estudio-auto \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project "$PROJECT_ID"
```

Variables opcionales:

```bash
export REGION="us-central1"
export REPOSITORY="car-detailing"
export SERVICE="estudio-auto"
```

## Opción recomendada: Cloud Build Trigger desde GitHub

Para este proyecto, la mejor opción es un pipeline nativo de GCP con **GitHub → Cloud Build Trigger → Artifact Registry → Cloud Run**. No es necesario mantener runners, las credenciales permanecen en GCP y cada revisión se puede rastrear hasta el commit que la generó.

El pipeline incluido aplica este flujo:

1. GitHub notifica a Cloud Build después de integrar un cambio en la rama configurada.
2. El `Dockerfile` ejecuta los tests y compila la aplicación; si alguno falla, no se despliega nada.
3. Cloud Build publica una imagen etiquetada con `$COMMIT_SHA`, evitando sobrescribir versiones con `latest`.
4. Cloud Run crea una revisión inmutable con esa imagen y dirige el tráfico a la nueva revisión.
5. Si surge un problema, se puede volver inmediatamente a una revisión anterior desde Cloud Run.

### Configuración del despliegue continuo

1. Sube esta rama al repositorio existente:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/proyectocarrojosuesofia.git
   git push -u origin work
   ```
   Si `origin` ya existe, utiliza `git remote set-url origin URL` en lugar de `git remote add`.
2. Abre **Google Cloud Console → Cloud Build → Repositories (2nd gen)** y selecciona **Link repository**.
3. Elige **GitHub**, autoriza la aplicación de Google Cloud Build y selecciona `proyectocarrojosuesofia`.
4. En **Cloud Build → Triggers**, crea un trigger de evento **Push to a branch**. Para producción, utiliza `^main$` y protege `main` en GitHub para que solo reciba cambios mediante pull request aprobado.
5. Selecciona **Cloud Build configuration file** e indica `/GCP-infra/cloudbuild.yaml`.
6. Configura la cuenta de servicio del trigger con permisos mínimos de **Cloud Run Admin**, **Artifact Registry Writer**, **Service Account User** y **Logs Writer**.
7. Antes del primer build, crea el repositorio de imágenes:
   ```bash
   gcloud artifacts repositories create car-detailing \
     --repository-format=docker \
     --location=us-central1 \
     --project="$PROJECT_ID"
   ```
8. Ejecuta el trigger manualmente una primera vez. Después, cada cambio integrado en `main` iniciará el pipeline automáticamente. Al terminar, consulta la URL con:
   ```bash
   gcloud run services describe estudio-auto \
     --region us-central1 \
     --format='value(status.url)'
   ```

El pipeline usa por defecto `us-central1`, el repositorio `car-detailing` y el servicio `estudio-auto`. Cada imagen usa el SHA completo del commit como etiqueta inmutable. La región, el repositorio y el servicio pueden sobrescribirse mediante `_REGION`, `_REPOSITORY` y `_SERVICE` en el trigger.

### Entornos y estrategia de ramas

Para una prueba sencilla basta con un trigger de `main` hacia `estudio-auto`. Si después necesitas separar ambientes, crea dos triggers reutilizando el mismo archivo:

| Rama | Servicio Cloud Run | Uso |
| --- | --- | --- |
| `develop` | `estudio-auto-staging` | Validación antes de liberar |
| `main` | `estudio-auto` | Producción |

En el trigger de `develop`, sobrescribe `_SERVICE=estudio-auto-staging`. En producción, conserva `_SERVICE=estudio-auto`. Nunca guardes llaves JSON de cuentas de servicio en GitHub; el trigger debe utilizar una cuenta de servicio administrada en GCP con los permisos mínimos descritos arriba.

### Rollback

Cloud Run conserva revisiones anteriores. Para regresar todo el tráfico a una revisión estable:

```bash
gcloud run revisions list --service estudio-auto --region us-central1
gcloud run services update-traffic estudio-auto \
  --region us-central1 \
  --to-revisions REVISION_ESTABLE=100
```

GitHub Actions también puede realizar el despliegue, pero solo lo recomendaría si el resto de tus automatizaciones ya vive en GitHub. En ese caso, autentica con Workload Identity Federation; no uses una clave de cuenta de servicio descargable.

## Probar la imagen localmente

```bash
docker build -t estudio-auto:test .
docker run --rm -p 8080:8080 estudio-auto:test
curl http://localhost:8080/health
```

Abre `http://localhost:8080` en el navegador.
