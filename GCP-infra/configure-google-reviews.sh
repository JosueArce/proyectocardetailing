#!/usr/bin/env sh
set -eu

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID}"
REGION="${REGION:-us-west1}"
SERVICE="${SERVICE:-proyectocardetailing}"
RUNTIME_SA="${RUNTIME_SA:-estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com}"
: "${GOOGLE_PLACE_ID:?Define GOOGLE_PLACE_ID con el Place ID del perfil de AutoEstudioCR}"
: "${GOOGLE_MAPS_API_KEY:?Define GOOGLE_MAPS_API_KEY con una clave restringida a Places API}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-}"
SECRET_NAME="autoestudiocr-google-maps-api-key"

gcloud services enable places.googleapis.com secretmanager.googleapis.com --project="$PROJECT_ID"

if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  printf %s "$GOOGLE_MAPS_API_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$PROJECT_ID" >/dev/null
else
  printf %s "$GOOGLE_MAPS_API_KEY" | gcloud secrets create "$SECRET_NAME" --replication-policy=automatic --data-file=- --project="$PROJECT_ID" >/dev/null
fi

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/secretmanager.secretAccessor >/dev/null

ENV_VARS="GOOGLE_PLACE_ID=$GOOGLE_PLACE_ID"
if [ -n "$PUBLIC_SITE_URL" ]; then ENV_VARS="$ENV_VARS,PUBLIC_SITE_URL=$PUBLIC_SITE_URL"; fi

gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --update-secrets="GOOGLE_MAPS_API_KEY=$SECRET_NAME:latest" \
  --update-env-vars="$ENV_VARS"

SERVICE_URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
printf '\nReseñas de Google configuradas. Comprueba la respuesta pública:\n%s/api/reviews\n' "$SERVICE_URL"
