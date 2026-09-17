# Firestore y Cloud Storage

La persistencia se limita al portafolio público:

- Firestore Native: colección `projects`.
- Cloud Storage privado: fotografías y videos.
- Cloud Run: lectura, publicación y entrega controlada de medios.

No se almacenan usuarios, vehículos, reservaciones, pagos, gastos, promociones o fechas bloqueadas.

## Crear o revalidar recursos

```bash
export PROJECT_ID="tu-id-de-proyecto"
export REGION="us-west1"
./GCP-infra/storage/setup.sh
```

El script es idempotente y no elimina datos en una ejecución normal. Crea:

- base de datos Firestore `(default)`;
- bucket `${PROJECT_ID}-estudio-auto-evidence`;
- prevención de acceso público y acceso uniforme;
- política de ciclo de vida;
- permisos para `estudio-auto-calendar`;
- marcadores `projects/_estructura/photos` y `projects/_estructura/videos`.

## Modelo

```text
projects/{projectId}
├── title
├── description
├── published
├── createdAt
└── media[]

Cloud Storage
projects/{projectId}/photos/{archivo}
projects/{projectId}/videos/{archivo}
```

Cloud Storage usa prefijos, no carpetas físicas. Cada proyecto debe tener un documento Firestore para aportar título, descripción y estado de publicación.

## Hard reset del portafolio

```bash
./GCP-infra/storage/setup.sh --hard-reset
```

El flag elimina permanentemente usuarios heredados de Firebase Authentication, todos los documentos de Firestore —incluidas antiguas cuentas, vehículos y reservaciones— y todos los objetos del bucket; después recrea los marcadores iniciales. No elimina el proyecto GCP, Firestore, el bucket, cuentas de servicio, secretos o Google Reviews.

```bash
./GCP-infra/storage/setup.sh --help
```

## Reglas e índices

El navegador no consulta Firestore directamente; las reglas deniegan todo acceso cliente. Cloud Run utiliza IAM. El portafolio no requiere índices compuestos.

Los archivos se pueden aplicar con Firebase CLI si el proyecto ya está vinculado:

```bash
firebase use "$PROJECT_ID"
firebase deploy --only firestore:rules,firestore:indexes --config GCP-infra/storage/firebase.json
```

## Verificación

```bash
gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID"
gcloud storage ls "gs://$PROJECT_ID-estudio-auto-evidence/projects/**"
gcloud projects get-iam-policy "$PROJECT_ID" --flatten='bindings[].members' --filter="bindings.members:estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com"
```
