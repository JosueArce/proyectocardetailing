#!/usr/bin/env sh
set -eu

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID}"
REGION="${REGION:-us-west1}"
SERVICE="${SERVICE:-proyectocardetailing}"
RUNTIME_SA="estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com"
: "${RESEND_API_KEY:?Define RESEND_API_KEY}"
: "${EMAIL_FROM:?Define EMAIL_FROM, por ejemplo Citas <citas@tudominio.cr>}"
: "${WHATSAPP_ACCESS_TOKEN:?Define WHATSAPP_ACCESS_TOKEN}"
: "${WHATSAPP_PHONE_NUMBER_ID:?Define WHATSAPP_PHONE_NUMBER_ID}"
: "${WHATSAPP_TEMPLATE_NAME:?Define WHATSAPP_TEMPLATE_NAME}"

gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"

put_secret() {
  name="$1"; value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    printf %s "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID" >/dev/null
  else
    printf %s "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- --project="$PROJECT_ID" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" --project="$PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_SA" --role=roles/secretmanager.secretAccessor >/dev/null
}

put_secret estudio-auto-resend-api-key "$RESEND_API_KEY"
put_secret estudio-auto-whatsapp-token "$WHATSAPP_ACCESS_TOKEN"

gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --update-secrets="RESEND_API_KEY=estudio-auto-resend-api-key:latest,WHATSAPP_ACCESS_TOKEN=estudio-auto-whatsapp-token:latest" \
  --update-env-vars="EMAIL_FROM=$EMAIL_FROM,OWNER_EMAIL=josue.arce.gonzalez@gmail.com,WHATSAPP_PHONE_NUMBER_ID=$WHATSAPP_PHONE_NUMBER_ID,WHATSAPP_TEMPLATE_NAME=$WHATSAPP_TEMPLATE_NAME,WHATSAPP_API_VERSION=${WHATSAPP_API_VERSION:-v23.0}"

printf 'Notificaciones configuradas en %s (%s).\n' "$SERVICE" "$REGION"
