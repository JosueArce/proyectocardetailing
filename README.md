# Estudio Auto

Landing page responsiva para un negocio de detallado automotriz. Incluye servicios, precios, productos profesionales, reservación sin registro, cuentas de cliente con vehículos e historial, y un panel administrativo para citas, fechas bloqueadas, ingresos y gastos.

El prototipo está localizado para Costa Rica: precios, ingresos, gastos y ganancias se presentan en colones costarricenses (CRC). La historia de marca identifica a Josue Arce, de 29 años, como fundador del proyecto.


Las reservaciones se conectan con Google Calendar mediante el servidor de Cloud Run y generan una notificación para Josue. La configuración inicial de permisos está documentada en [`GCP-infra/README.md`](GCP-infra/README.md#integración-con-google-calendar).

El despliegue continuo de `main` se crea con `GCP-infra/create-trigger.sh`: cada merge aprobado genera una imagen identificada por el SHA del commit y una nueva revisión de Cloud Run.

### Accesos de demostración

El acceso administrativo local para evaluar el prototipo es `admin@estudioauto.com` / `admin123`. Las cuentas, contraseñas, vehículos, citas y finanzas se guardan solamente en `localStorage`; esta implementación no ofrece seguridad real y debe sustituirse por autenticación, API y base de datos antes de operar con clientes reales.

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

Las reservaciones se almacenan en `localStorage` para que el prototipo funcione sin un servidor. En producción se recomienda conectar el formulario a una base de datos y proteger el panel administrativo mediante autenticación.

## Google Cloud Run

El [`Dockerfile`](Dockerfile) de la raíz está listo para que Cloud Run construya la aplicación desde el código fuente. Los archivos adicionales de Cloud Build, Nginx y despliegue se encuentran en [`GCP-infra/`](GCP-infra/README.md); la guía incluye despliegue manual y conexión continua desde GitHub.

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
