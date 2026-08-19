# Despliegue en Google Cloud Run

La raíz del proyecto contiene el `Dockerfile` multi-stage que Cloud Run detecta automáticamente. Esta carpeta contiene el pipeline de Cloud Build y los scripts de despliegue. La imagen final ejecuta el servidor Node que integra Calendar y sirve los archivos estáticos compilados.

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
gcloud run deploy proyectocardetailing \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --project "$PROJECT_ID"
```

Variables opcionales:

```bash
export REGION="us-west1"
export REPOSITORY="car-detailing"
export SERVICE="proyectocardetailing"
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

La configuración automatizada utiliza el repositorio `JosueArce/proyectocardetailing`, escucha exclusivamente `^main$` y evita crear el trigger dos veces:

```bash
export PROJECT_ID="tu-id-de-proyecto"
./GCP-infra/create-trigger.sh
```

Antes de ejecutar el script por primera vez, instala o autoriza la aplicación **Google Cloud Build** en el repositorio de GitHub desde **Cloud Build → Repositories**. El script crea las cuentas de servicio, asigna permisos mínimos y crea `deploy-main-cloud-run`. Si la conexión de GitHub aún no está autorizada, `gcloud` rechazará la creación del trigger y deberás completar ese paso en la consola.

El evento técnico es un `push` a `main`: GitHub produce ese evento cuando se integra un pull request. Para garantizar que nunca se despliegue un push directo, protege `main` en **GitHub → Settings → Branches → Add branch protection rule** y activa **Require a pull request before merging**.

1. Sube esta rama al repositorio existente:
   ```bash
   git remote add origin https://github.com/JosueArce/proyectocardetailing.git
   git push -u origin work
   ```
   Si `origin` ya existe, utiliza `git remote set-url origin URL` en lugar de `git remote add`.
2. Abre **Google Cloud Console → Cloud Build → Repositories (2nd gen)** y selecciona **Link repository**.
3. Elige **GitHub**, autoriza la aplicación de Google Cloud Build y selecciona `proyectocardetailing`.
4. En **Cloud Build → Triggers**, crea un trigger de evento **Push to a branch**. Para producción, utiliza `^main$` y protege `main` en GitHub para que solo reciba cambios mediante pull request aprobado.
5. Selecciona **Cloud Build configuration file** e indica `/GCP-infra/cloudbuild.yaml`.
6. Configura la cuenta de servicio del trigger con permisos mínimos de **Cloud Run Admin**, **Artifact Registry Writer**, **Service Account User** y **Logs Writer**.
7. Antes del primer build, crea el repositorio de imágenes:
   ```bash
   gcloud artifacts repositories create car-detailing \
     --repository-format=docker \
     --location=us-west1 \
     --project="$PROJECT_ID"
   ```
8. Ejecuta el trigger manualmente una primera vez. Después, cada cambio integrado en `main` iniciará el pipeline automáticamente. Al terminar, consulta la URL con:
   ```bash
   gcloud run services describe proyectocardetailing \
     --region us-west1 \
     --format='value(status.url)'
   ```

El pipeline usa por defecto `us-west1`, el repositorio `car-detailing` y el servicio `estudio-auto`. Cada imagen usa el SHA completo del commit como etiqueta inmutable. La región, el repositorio y el servicio pueden sobrescribirse mediante `_REGION`, `_REPOSITORY` y `_SERVICE` en el trigger.

### Entornos y estrategia de ramas

Para una prueba sencilla basta con un trigger de `main` hacia `estudio-auto`. Si después necesitas separar ambientes, crea dos triggers reutilizando el mismo archivo:

| Rama | Servicio Cloud Run | Uso |
| --- | --- | --- |
| `develop` | `proyectocardetailing-staging` | Validación antes de liberar |
| `main` | `proyectocardetailing` | Producción |

En el trigger de `develop`, sobrescribe `_SERVICE=proyectocardetailing-staging`. En producción, conserva `_SERVICE=proyectocardetailing`. Nunca guardes llaves JSON de cuentas de servicio en GitHub; el trigger debe utilizar una cuenta de servicio administrada en GCP con los permisos mínimos descritos arriba.

### Rollback

Cloud Run conserva revisiones anteriores. Para regresar todo el tráfico a una revisión estable:

```bash
gcloud run revisions list --service proyectocardetailing --region us-west1
gcloud run services update-traffic estudio-auto \
  --region us-west1 \
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

## Integración con Google Calendar

El servidor crea un evento en `josue.arce.gonzalez@gmail.com` cuando el formulario confirma una cita. La integración utiliza las credenciales automáticas de la cuenta de servicio de Cloud Run; no se deben guardar llaves JSON en el repositorio.

### Configuración inicial

1. Habilita Google Calendar API:
   ```bash
   gcloud services enable calendar-json.googleapis.com --project="$PROJECT_ID"
   ```
2. Crea la cuenta de servicio dedicada que ejecutará Cloud Run (el script `deploy.sh` también la crea automáticamente):
   ```bash
   gcloud iam service-accounts create estudio-auto-calendar \
     --display-name="Estudio Auto Calendar" \
     --project="$PROJECT_ID"
   ```
3. En Google Calendar, abre **Configuración → Configuración de mis calendarios → Compartir con personas o grupos específicos**. Agrega `estudio-auto-calendar@TU_PROJECT_ID.iam.gserviceaccount.com` con permiso **Hacer cambios en eventos**.
4. En la configuración de ese calendario, abre **Otras notificaciones → Eventos nuevos** y selecciona **Correo electrónico**. Así Google Calendar enviará a `josue.arce.gonzalez@gmail.com` una notificación cuando la cuenta de servicio agregue una cita.
5. Despliega el servicio. El pipeline define `GOOGLE_CALENDAR_ID` como `josue.arce.gonzalez@gmail.com`.
6. Registra una cita de prueba y confirma que el evento aparece y llega la notificación. Revisa spam y la configuración anterior si el correo no aparece.

Para utilizar un calendario separado, créalo, compártelo con la cuenta de servicio y reemplaza `GOOGLE_CALENDAR_ID` por el ID que aparece en **Integrar calendario**. El endpoint valida los datos, utiliza la zona horaria `America/Costa_Rica` y responde con error sin registrar localmente la cita si Calendar no la confirma.

### Diagnóstico de un error 502

Los comandos deben usar el nombre y la región reales del servicio. Para este proyecto son `proyectocardetailing` y `us-west1`; consultar `estudio-auto` en `us-central1` no mostrará los logs del servicio desplegado.

```bash
gcloud run services logs read proyectocardetailing \
  --region=us-west1 \
  --project="$PROJECT_ID" \
  --limit=100

gcloud run services describe proyectocardetailing \
  --region=us-west1 \
  --project="$PROJECT_ID" \
  --format='yaml(spec.template.spec.serviceAccountName,spec.template.spec.containers[0].env,status.url)'
```

La revisión debe usar `estudio-auto-calendar@TU_PROJECT_ID.iam.gserviceaccount.com` y definir `GOOGLE_CALENDAR_ID`. Si fue desplegada con la cuenta predeterminada, corrígela:

```bash
gcloud run services update proyectocardetailing \
  --region=us-west1 \
  --project="$PROJECT_ID" \
  --service-account="estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com" \
  --set-env-vars="GOOGLE_CALENDAR_ID=josue.arce.gonzalez@gmail.com"
```

Finalmente, comparte el calendario con exactamente la cuenta que muestra `serviceAccountName`. Los nuevos logs incluyen el código y motivo devueltos por Calendar para distinguir API deshabilitada, calendario inexistente o permisos insuficientes.

### La revisión no escucha en `PORT=8080`

Este mensaje corresponde al arranque del contenedor, no a Firestore ni a Cloud Storage. La imagen escucha automáticamente la variable `PORT`; además, Calendar se carga bajo demanda para reducir el consumo durante el inicio. En la captura del servicio el límite es **128 MiB**, mientras que el pipeline del repositorio configura **256 MiB**. Actualiza la revisión a 256 MiB y vuelve a desplegar:

```bash
gcloud run services update proyectocardetailing \
  --region=us-west1 \
  --project="$PROJECT_ID" \
  --memory=256Mi \
  --port=8080
```

Después consulta los logs de la revisión fallida; la línea `Estudio Auto escuchando en el puerto 8080` confirma que el proceso inició correctamente. Si despliegas con el trigger de `GCP-infra/cloudbuild.yaml`, esta memoria y el puerto ya se aplican automáticamente.


## Correo y WhatsApp de confirmación

Después de crear el evento, el servidor puede enviar un correo transaccional con Resend y un mensaje mediante WhatsApp Business Cloud API. Una falla de notificación no elimina la cita ni el evento de Calendar; queda registrada en los logs como `failed` o `skipped`.

### Correo

1. Crea una cuenta en Resend y verifica un dominio de envío.
2. Genera una API key y define un remitente del dominio verificado, por ejemplo `Citas <citas@tudominio.cr>`.
3. El correo se envía al cliente y a `josue.arce.gonzalez@gmail.com` con servicio, vehículo, fecha, hora y costo.

### WhatsApp

Necesitas una cuenta de Meta Business, una aplicación con WhatsApp, un número de WhatsApp Business, su **Phone Number ID** y un token. Para notificar automáticamente fuera de una conversación iniciada por el cliente, Meta requiere una plantilla aprobada y consentimiento del cliente. El formulario incluye una aceptación opcional; si el cliente no la marca, el servidor no envía WhatsApp.

Crea una plantilla en español con cinco variables de cuerpo, en este orden:

```text
Hola {{1}}, tu cita de detallado fue registrada.
Servicio: {{2}}
Fecha: {{3}}
Hora: {{4}}
Vehículo: {{5}}
```

Cuando ambos proveedores estén listos, configura Secret Manager y Cloud Run desde una terminal segura:

```bash
export PROJECT_ID="tu-id-de-proyecto"
export RESEND_API_KEY="re_..."
export EMAIL_FROM="Citas <citas@tudominio.cr>"
export WHATSAPP_ACCESS_TOKEN="..."
export WHATSAPP_PHONE_NUMBER_ID="..."
export WHATSAPP_TEMPLATE_NAME="cita_registrada"
export ADMIN_PASSWORD="una-contraseña-administrativa-segura"
export SESSION_SECRET="$(openssl rand -hex 32)"
./GCP-infra/configure-notifications.sh
```

El script guarda los tokens como secretos, concede acceso únicamente a la cuenta de servicio de Cloud Run y crea una revisión con la configuración. El pipeline usa `--update-env-vars`, por lo que los siguientes despliegues conservan estos secretos y variables. Nunca agregues esos valores a Git, `cloudbuild.yaml` o archivos `.env` compartidos.
