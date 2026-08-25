#!/usr/bin/env sh
set -eu

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID}"
REGION="${REGION:-us-west1}"
BUCKET="${BUCKET:-$PROJECT_ID-estudio-auto-evidence}"
RUNTIME_SA="${RUNTIME_SA:-estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com}"

gcloud services enable firestore.googleapis.com storage.googleapis.com --project="$PROJECT_ID"

gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native --project="$PROJECT_ID"

gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT_ID" --location="$REGION" --uniform-bucket-level-access --public-access-prevention

gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=GCP-infra/storage/lifecycle.json

gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" --role=roles/datastore.user --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$RUNTIME_SA" --role=roles/storage.objectAdmin >/dev/null

# Cloud Storage representa las carpetas como prefijos. Estos marcadores hacen
# visible la estructura inicial; cada publicación crea su propio projectId.
MARKER_DIR="$(mktemp -d)"
trap 'rm -rf "$MARKER_DIR"' EXIT
printf 'Archivos de proyectos publicados desde AutoEstudioCR.\n' > "$MARKER_DIR/README.txt"
: > "$MARKER_DIR/.keep"
gcloud storage cp "$MARKER_DIR/README.txt" "gs://$BUCKET/projects/README.txt" >/dev/null
gcloud storage cp "$MARKER_DIR/.keep" "gs://$BUCKET/projects/_estructura/photos/.keep" >/dev/null
gcloud storage cp "$MARKER_DIR/.keep" "gs://$BUCKET/projects/_estructura/videos/.keep" >/dev/null

printf 'Firestore y gs://%s están preparados en %s.\n' "$BUCKET" "$REGION"
