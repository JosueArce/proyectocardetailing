# AutoEstudioCR Detailing

Aplicación web responsiva para **AutoEstudioCR Detailing**, un negocio costarricense de detallado automotriz. Incluye el catálogo oficial de servicios, precios, productos profesionales, reservación sin registro, cuentas de cliente con vehículos e historial, y un panel administrativo para citas, fechas bloqueadas, ingresos y gastos.

## Catálogo oficial

El catálogo se organiza en tres grupos y utiliza colones costarricenses (CRC):

* **Servicios oficiales:** detallado interior (₡5.000) y detallado exterior (₡6.000).
* **Tratamientos:** protección cerámica en carrocería (₡50.000), aros (₡10.000) y tapizados (₡20.000).
* **Servicios adicionales:** limpieza profunda de tapizados (₡5.000), pulido de vidrios y cerámico (₡10.000), restauración de focos (₡6.500), pulido de carrocería (₡20.000), descontaminación exterior (₡15.000) y abrillantado de carrocería (₡20.000).

Los precios están sujetos a cambios según la condición y características del vehículo. Los futuros paquetes o combos combinarán estos servicios individuales y se agregarán como una etapa posterior.

El cliente puede combinar servicios de dos maneras: seleccionándolos directamente dentro del modal de reservación o agregándolos al carrito mientras navega por el catálogo. La selección se conserva localmente hasta completar la cita, y el servidor vuelve a calcular el costo y la duración total usando únicamente el catálogo autorizado.

La sección **Resultados que hablan** consulta proyectos publicados en Firestore. Desde administración se puede agregar el nombre, la descripción del trabajo y hasta seis fotografías o videos; Cloud Run guarda los archivos bajo `projects/{projectId}/photos/` y `projects/{projectId}/videos/` en el bucket privado y entrega el contenido mediante la API pública del portafolio.

También se reconocen archivos agregados directamente desde la consola de Cloud Storage. Para que se relacionen con un proyecto existente deben conservar exactamente su ID de Firestore y esta estructura: `projects/{projectId}/photos/archivo.jpg` o `projects/{projectId}/videos/archivo.mp4`. La API reconstruye la galería desde el contenido real del bucket cada vez que se carga la lista de proyectos; subir el archivo fuera de esos prefijos no modifica la descripción ni crea un proyecto nuevo.

La identidad visual oficial se almacena como un SVG vectorial en `public/autoestudiocr-logo.svg`; no contiene imágenes binarias embebidas, se mantiene nítido a cualquier tamaño y evita incompatibilidades con el creador de pull requests. El servidor entrega los archivos públicos de Vite desde la raíz de `dist`, antes del fallback de la SPA, para que el navegador reciba el logo como `image/svg+xml` y no como HTML. El encabezado y el pie utilizan únicamente esta imagen completa, sin duplicar el nombre del negocio con texto adicional.

El historial permite abrir cada reserva, consultar estado, trabajo realizado y evidencias. Administración puede aprobar, finalizar o cancelar la cita, documentar el trabajo y agregar URLs de fotografías o videos; por ahora se incluyen imágenes demostrativas y posteriormente se reemplazarán por cargas a Cloud Storage.

Las actualizaciones administrativas guardan primero el estado operativo en Firestore. Una falla al sincronizar la agenda o enviar el correo se presenta como advertencia y no impide aprobar, pagar, finalizar o cancelar la cita. Para finalizar un servicio es obligatorio registrar antes el pago; la interfaz explica este requisito al presionar **Finalizar**.

El prototipo está localizado para Costa Rica: precios, ingresos, gastos y ganancias se presentan en colones costarricenses (CRC). La historia de marca identifica a Josue Arce, de 29 años, como fundador del proyecto.

Las reservaciones se conectan con Google Calendar mediante el servidor de Cloud Run y generan una notificación para Josue. La configuración inicial de permisos está documentada en [`GCP-infra/README.md`](GCP-infra/README.md#integración-con-google-calendar).

Las confirmaciones por correo y WhatsApp Business son opcionales y se configuran con Secret Manager mediante `GCP-infra/configure-notifications.sh`.

El cliente y Josue reciben correo al registrar la cita y también cuando administración la aprueba, cancela, finaliza, documenta el trabajo o agrega evidencias. Las actualizaciones administrativas utilizan una sesión segura HttpOnly y sincronizan el evento de Calendar cuando existe un `calendarEventId`.

Todos los mensajes visibles para clientes están en español y evitan nombres internos de proveedores. El panel administrativo muestra únicamente un escudo verde o rojo para resumir el estado de los servicios; los detalles técnicos permanecen en Cloud Logging.

El formulario permite seleccionar **SINPE Móvil** o **efectivo**. SINPE solicita un comprobante y ambas opciones mantienen la cita pendiente hasta la revisión administrativa; el pago con tarjeta ya aparece como una opción visual deshabilitada. Administración registra el pago antes de poder terminar el servicio. Antes de desplegar, reemplaza `_SINPE_PHONE` en `GCP-infra/cloudbuild.yaml` por el número real que se mostrará públicamente.

La persistencia utiliza Firestore Native para reservaciones, perfiles, vehículos, gastos y fechas bloqueadas; Firebase Authentication administra identidades y Cloud Storage conserva comprobantes SINPE. El panel administrativo obtiene la operación desde Firestore. Los scripts, reglas, índices, diagramas y pasos de verificación están en [`GCP-infra/storage/`](GCP-infra/storage/README.md).

Firestore y el bucket no se crean durante cada deploy. Se preparan una sola vez con `./GCP-infra/storage/setup.sh`; las siguientes revisiones de Cloud Run reutilizan esos recursos.

Para eliminar deliberadamente todos los datos de prueba de Firebase Authentication, Firestore y Cloud Storage se puede ejecutar `./GCP-infra/storage/setup.sh --hard-reset`. El flag es obligatorio para borrar; una ejecución normal nunca elimina datos. Consulta el alcance y las advertencias en [`GCP-infra/storage/README.md`](GCP-infra/storage/README.md#reiniciar-todos-los-datos-de-prueba).

El despliegue continuo de `main` se crea con `GCP-infra/create-trigger.sh`: cada merge aprobado genera una imagen identificada por el SHA del commit y una nueva revisión de Cloud Run.

### Acceso administrativo

La cuenta administrativa inicial usa el correo `josue.arce.gonzalez@gmail.com`, la contraseña `Admin123!` y el teléfono `83629162`. En producción, cambia inmediatamente la contraseña mediante Secret Manager. Las cuentas de cliente utilizan Firebase Authentication y una cookie HttpOnly; Firestore conserva perfiles, vehículos, citas, gastos y fechas bloqueadas.

El número público de SINPE Móvil es `+506 8362-9162`. Desde el panel administrativo se pueden seleccionar simultáneamente hasta seis fotos o videos (JPG, PNG, WEBP, MP4, WEBM o MOV) para cada proyecto; también se pueden agregar en varias selecciones antes de publicarlo.

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run lint
npm run build
npm test
npm run test:coverage
```

El contenedor ejecuta una prueba real del servidor y de `/health` durante la construcción. Cloud Run utiliza 512 MiB y el servidor escucha en la variable `PORT` proporcionada por la plataforma. La guía para diagnosticar una revisión que no inicia está en [`GCP-infra/README.md`](GCP-infra/README.md#la-revisión-no-escucha-en-port8080).

Los datos operativos se guardan en Firestore y los comprobantes en Cloud Storage. `localStorage` se utiliza únicamente como caché de interfaz; las credenciales de clientes son administradas por Firebase Authentication.

## Aparición en Google y opiniones

El sitio incluye metadatos en español para buscadores y redes sociales, datos estructurados de negocio local, `robots.txt` y `sitemap.xml`. Para completar la indexación:

1. Define `PUBLIC_SITE_URL` con el dominio público definitivo, preferiblemente un dominio propio.
2. Registra y verifica ese dominio en Google Search Console.
3. Envía `https://TU_DOMINIO/sitemap.xml` desde Search Console.
4. Completa Google Business Profile con dirección o zona de servicio, horario, teléfono, fotografías y el enlace de reserva.
5. Publica proyectos reales con títulos y descripciones útiles de forma periódica.

La sección **Opiniones** consulta reseñas públicas de Google Maps mediante Places API (New). Configura `GOOGLE_PLACE_ID` y guarda `GOOGLE_MAPS_API_KEY` como secreto de Cloud Run; restringe esa clave a Places API y al proyecto GCP. La respuesta se conserva en caché durante una hora y, si Google no está configurado o no responde, la web presenta una opinión local de respaldo sin mostrar fallos técnicos. Google determina cuáles y cuántas reseñas devuelve; el botón de la sección permite abrir el perfil, consultar todas y escribir una nueva.

Las reseñas deben conservar el autor, texto y calificación originales. Para publicar testimonios recibidos directamente fuera de Google, solicita consentimiento explícito y utiliza un flujo de moderación antes de hacerlos públicos.

## Google Cloud Run

El [`Dockerfile`](Dockerfile) de la raíz está listo para que Cloud Run construya la aplicación desde el código fuente. Los archivos adicionales de Cloud Build y despliegue se encuentran en [`GCP-infra/`](GCP-infra/README.md); la guía incluye despliegue manual, Calendar y conexión continua desde GitHub.

## Conectar GitHub y crear el primer pull request

Antes de crear un PR, el repositorio local necesita tres cosas: un remoto `origin`, una sesión autenticada de GitHub CLI y una rama publicada. Los ejemplos ya utilizan el repositorio `JosueArce/proyectocardetailing`:

### ¿Dónde ejecutar estos comandos?

Ejecuta los comandos en la aplicación **Terminal de tu Mac**, dentro de la carpeta donde clonaste este repositorio. No se escriben en GitHub ni dentro del navegador.

```bash
# Abre Terminal y entra al proyecto; ajusta la ruta a la ubicación real.
cd ~/ruta/donde/clonaste/proyectocardetailing

# Confirma que estás en el repositorio correcto.
pwd
git status
```

Si todavía no tienes el proyecto en tu Mac, primero clónalo y entra en él:

```bash
git clone https://github.com/JosueArce/proyectocardetailing.git
cd proyectocardetailing
```

Necesitas tener instalados `git` y GitHub CLI (`gh`). Los comandos de despliegue también requieren Google Cloud CLI (`gcloud`), pero `gcloud` no es necesario para crear un pull request. Como alternativa, los comandos de GCP pueden ejecutarse en **Google Cloud Shell**; los comandos de Git y GitHub son más sencillos desde tu Mac, donde está el proyecto.

```bash
# 1. Conectar este clon con el repositorio de GitHub
git remote add origin https://github.com/JosueArce/proyectocardetailing.git

# Si origin ya existiera con una URL incorrecta, usa en su lugar:
# git remote set-url origin https://github.com/JosueArce/proyectocardetailing.git

# 2. Autenticar GitHub CLI (elige GitHub.com, HTTPS y Login with a web browser)
gh auth login
gh auth status

# 3. Publicar la rama local y configurar su upstream
git push -u origin work

# 4. Crear el PR hacia main
gh pr create --base main --head work --fill
```

Puedes comprobar la conexión antes de crear el PR:

```bash
git remote -v
git branch -vv
gh repo view --json nameWithOwner,defaultBranchRef,url
gh pr status
```

Si el repositorio utiliza `master` como rama predeterminada, sustituye `--base main` por `--base master`. Si GitHub responde `No commits between main and work`, la rama ya fue integrada o no contiene cambios nuevos. Si responde `Resource not accessible`, la cuenta autenticada no tiene acceso al repositorio o el token no tiene permisos para escribir pull requests.
