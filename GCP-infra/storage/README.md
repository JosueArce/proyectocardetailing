# Persistencia económica: Firestore + Cloud Storage

## Decisión

Se propone **Firestore Native** para usuarios, vehículos, reservas, pagos, gastos y bloqueos, y un bucket privado de **Cloud Storage** para comprobantes SINPE, fotografías, documentos y videos. Ambos servicios son serverless: no requieren una instancia encendida ni una cuota fija por servidor. Firestore cobra principalmente por operaciones y almacenamiento; Storage por bytes almacenados, operaciones y transferencia. Un recurso vacío no ejecuta cómputo, aunque los archivos y datos guardados sí generan el consumo correspondiente.

Cloud Run será la única capa con acceso a datos. El navegador nunca recibe credenciales del bucket ni acceso directo a Firestore. Para futuras cargas se usarán URLs firmadas de corta duración.

## Arquitectura

```mermaid
flowchart LR
  C[Cliente] -->|HTTPS| R[Cloud Run API]
  A[Administrador] -->|Cookie HttpOnly| R
  R --> F[(Firestore)]
  R --> G[(Google Calendar)]
  R --> E[Resend / WhatsApp]
  R -->|URL firmada| S[(Cloud Storage privado)]
  C -. carga evidencia .-> S
  A -. carga fotos y videos .-> S
  S -->|metadata| F
```

## Modelo de datos

```mermaid
erDiagram
  USERS ||--o{ VEHICLES : posee
  USERS ||--o{ BOOKINGS : reserva
  VEHICLES ||--o{ BOOKINGS : recibe
  BOOKINGS ||--o{ EVIDENCE : contiene
  BOOKINGS ||--o{ PAYMENT_EVENTS : registra
  USERS ||--o{ EXPENSES : registra

  USERS {
    string id
    string email
    string name
    string phone
    string role
    timestamp createdAt
  }
  VEHICLES {
    string id
    string customerId
    string make
    string model
    string year
    string plate
  }
  BOOKINGS {
    string id
    string customerId
    string vehicleId
    string service
    string status
    string paymentMethod
    string paymentStatus
    timestamp startsAt
    number costCRC
    string calendarEventId
    string workDone
  }
  EVIDENCE {
    string id
    string bookingId
    string type
    string storagePath
    string label
    timestamp createdAt
  }
  PAYMENT_EVENTS {
    string id
    string bookingId
    string type
    string status
    number amountCRC
    string evidencePath
    timestamp createdAt
  }
```

## Flujo de reservación y pago

```mermaid
stateDiagram-v2
  [*] --> Pendiente: Reserva creada
  Pendiente --> Confirmada: Admin aprueba
  Pendiente --> Cancelada: Admin cancela
  Confirmada --> Pagada: SINPE aprobado o efectivo recibido
  Pagada --> Completada: Admin termina trabajo
  Confirmada --> Cancelada: Admin cancela
  Completada --> [*]
```

### SINPE Móvil

1. El cliente selecciona SINPE y ve el número configurado.
2. Cloud Run genera una URL firmada para `payments/{bookingId}/receipt`.
3. El cliente sube imagen o PDF al bucket privado.
4. Firestore registra el `storagePath`; la reserva sigue `Pendiente`.
5. El administrador revisa el comprobante y aprueba pago + reserva.
6. Se envían correos al cliente y a Josue.

### Efectivo

1. La reserva inicia `Pendiente` y `paymentStatus=Pendiente`.
2. El administrador aprueba la reserva.
3. El día de la cita marca `paymentStatus=Pagado`.
4. La interfaz habilita **Finalizar**.

### Tarjeta

El método permanecerá deshabilitado hasta elegir proveedor, completar afiliación, políticas, 3-D Secure y webhooks. Nunca se almacenarán números de tarjeta, CVV ni datos sensibles en Firestore.

## Estructura del bucket

```text
bookings/{bookingId}/
├── payments/
│   └── sinpe-receipt.{jpg|png|pdf}
├── before/
│   ├── exterior-01.jpg
│   └── interior-01.jpg
├── after/
│   ├── exterior-01.jpg
│   └── walkthrough.mp4
└── documents/
    └── service-report.pdf

tmp/{uploadId}/...
```

`tmp/` se elimina automáticamente después de siete días y las cargas multipart incompletas después de un día mediante `lifecycle.json`.

## Seguridad

* Bucket privado, acceso público prevenido y Uniform Bucket-Level Access.
* Cloud Run recibe `roles/datastore.user` y `roles/storage.objectAdmin` solamente sobre los recursos necesarios.
* Reglas de Firestore deniegan acceso directo desde navegadores.
* La API valida usuario, rol, tipo MIME, tamaño y pertenencia de la reserva.
* Las URLs firmadas deben expirar en 10–15 minutos.
* Los comprobantes financieros no deben incluir datos bancarios innecesarios.
* Auditoría de cada cambio de estado y pago en `paymentEvents`.

## Crear recursos

Estos recursos **no se crean al desplegar una revisión de Cloud Run**. La aplicación no debe crear infraestructura durante su arranque. Se preparan una sola vez ejecutando `setup.sh`; después, las revisiones nuevas reutilizan la misma base de datos y el mismo bucket. El script es idempotente, por lo que se puede volver a ejecutar sin duplicarlos.

Desde la raíz:

```bash
export PROJECT_ID="tu-id-de-proyecto"
export REGION="us-west1"
./GCP-infra/storage/setup.sh
```

El script es idempotente, crea Firestore solo si no existe, crea un bucket privado, aplica ciclo de vida y asigna permisos a la cuenta de Cloud Run.

Puedes ejecutarlo desde **Cloud Shell** o desde una Mac con `gcloud` autenticado. Cloud Build tampoco lo ejecuta en cada merge: `cloudbuild.yaml` solamente construye y despliega la aplicación, evitando que la cuenta del pipeline necesite permisos administrativos permanentes para crear bases de datos o modificar IAM.

## Desplegar índices y reglas

Los archivos `firestore.rules` y `firestore.indexes.json` están listos para Firebase CLI cuando se conecte el proyecto:

```bash
firebase use "$PROJECT_ID"
firebase deploy --config GCP-infra/storage/firebase.json --only firestore:rules,firestore:indexes
```

La reservación ya se guarda en la colección `bookings`, el panel administrativo obtiene esa colección y los comprobantes SINPE se cargan al bucket privado. En esta primera integración el archivo viaja al servidor codificado en base64 y tiene un límite de 5 MB. Antes de producción conviene sustituir este transporte por URLs firmadas, migrar cuentas/vehículos/gastos/bloqueos desde `localStorage` y agregar autenticación persistente para que el cliente consulte su historial desde cualquier dispositivo.

## Verificar la integración desde el sitio

1. Despliega una revisión que defina `STORAGE_BUCKET`; el pipeline ya usa `${PROJECT_ID}-estudio-auto-evidence`.
2. Crea una cita de prueba, preferiblemente con un comprobante pequeño.
3. En Firestore, abre `bookings`: debe aparecer un documento con `calendarEventId`, `status` y `paymentStatus`.
4. En Cloud Storage, busca `bookings/{id}/payments/`: allí debe estar el comprobante.
5. Cierra el navegador, abre el panel administrativo e inicia sesión. El panel consulta `/api/admin/bookings` y debe mostrar el documento guardado, aunque `localStorage` esté vacío.
6. En la parte superior del panel, **Conexión GCP** debe mostrar en verde `Firestore conectado` y el nombre exacto del bucket. Si aparece rojo, el mismo indicador muestra la variable o permiso que falta.

También puedes comprobarlo desde Cloud Shell:

```bash
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/bookings?pageSize=10"
gcloud storage ls "gs://$PROJECT_ID-estudio-auto-evidence/bookings/**"
```

## Control de costos

1. Crear presupuestos y alertas en Cloud Billing (50%, 80% y 100%).
2. Mantener imágenes optimizadas y limitar videos.
3. Aplicar lifecycle a temporales y evidencias antiguas según política.
4. Paginar historial y evitar listeners permanentes innecesarios.
5. Usar caché y lecturas por demanda en Firestore.
6. Revisar mensualmente Storage Insights y métricas de Firestore.
