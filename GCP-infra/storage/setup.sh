#!/usr/bin/env sh
set -eu

HARD_RESET=false
for argument in "$@"; do
  case "$argument" in
    --hard-reset) HARD_RESET=true ;;
    -h|--help)
      printf 'Uso: %s [--hard-reset]\n\n' "$0"
      printf 'Sin opciones prepara o revalida la infraestructura sin borrar datos.\n'
      printf '%s\n' '--hard-reset elimina usuarios de Firebase Authentication, documentos de Firestore y objetos del bucket.'
      exit 0
      ;;
    *) printf 'Opción desconocida: %s\nUsa --help para consultar las opciones.\n' "$argument" >&2; exit 2 ;;
  esac
done

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID}"
REGION="${REGION:-us-west1}"
BUCKET="${BUCKET:-$PROJECT_ID-estudio-auto-evidence}"
RUNTIME_SA="${RUNTIME_SA:-estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com}"

gcloud services enable firestore.googleapis.com storage.googleapis.com identitytoolkit.googleapis.com --project="$PROJECT_ID"

gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native --project="$PROJECT_ID"

gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT_ID" --location="$REGION" --uniform-bucket-level-access --public-access-prevention

gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=GCP-infra/storage/lifecycle.json

gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" --role=roles/datastore.user --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$RUNTIME_SA" --role=roles/storage.objectAdmin >/dev/null

if [ "$HARD_RESET" = true ]; then
  printf '\nADVERTENCIA: se eliminarán permanentemente todos los datos de prueba de %s:\n' "$PROJECT_ID" >&2
  printf '  - usuarios de Firebase Authentication\n  - documentos de Firestore\n  - objetos de gs://%s\n\n' "$BUCKET" >&2
  printf 'El proceso comenzará en 5 segundos. Presiona Ctrl+C para cancelarlo.\n' >&2
  sleep 5
  ACCESS_TOKEN="$(gcloud auth print-access-token)" PROJECT_ID="$PROJECT_ID" BUCKET="$BUCKET" \
    node GCP-infra/storage/hard-reset.mjs
fi

# Cloud Storage representa las carpetas como prefijos. Estos marcadores hacen
# visible la estructura inicial; cada publicación crea su propio projectId.
MARKER_DIR="$(mktemp -d)"
trap 'rm -rf "$MARKER_DIR"' EXIT
printf 'Archivos de proyectos publicados desde AutoEstudioCR.\n' > "$MARKER_DIR/README.txt"
: > "$MARKER_DIR/.keep"
gcloud storage cp "$MARKER_DIR/README.txt" "gs://$BUCKET/projects/README.txt" >/dev/null
gcloud storage cp "$MARKER_DIR/.keep" "gs://$BUCKET/projects/_estructura/photos/.keep" >/dev/null
gcloud storage cp "$MARKER_DIR/.keep" "gs://$BUCKET/projects/_estructura/videos/.keep" >/dev/null

if [ "$HARD_RESET" = true ]; then
  printf 'Hard reset completado. Firestore, Firebase Authentication y gs://%s quedaron en estado inicial en %s.\n' "$BUCKET" "$REGION"
else
  printf 'Firestore y gs://%s están preparados en %s. No se borraron datos.\n' "$BUCKET" "$REGION"
fi
