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
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
: "${SESSION_SECRET:?Define SESSION_SECRET con al menos 32 caracteres aleatorios}"

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
put_secret estudio-auto-admin-password "$ADMIN_PASSWORD"
put_secret estudio-auto-session-secret "$SESSION_SECRET"

gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --update-secrets="RESEND_API_KEY=estudio-auto-resend-api-key:latest,WHATSAPP_ACCESS_TOKEN=estudio-auto-whatsapp-token:latest,ADMIN_PASSWORD=estudio-auto-admin-password:latest,SESSION_SECRET=estudio-auto-session-secret:latest" \
  --update-env-vars="EMAIL_FROM=$EMAIL_FROM,OWNER_EMAIL=josue.arce.gonzalez@gmail.com,OWNER_PHONE=83629162,ADMIN_EMAIL=josue.arce.gonzalez@gmail.com,ADMIN_PHONE=83629162,WHATSAPP_PHONE_NUMBER_ID=$WHATSAPP_PHONE_NUMBER_ID,WHATSAPP_TEMPLATE_NAME=$WHATSAPP_TEMPLATE_NAME,WHATSAPP_API_VERSION=${WHATSAPP_API_VERSION:-v23.0}"

printf 'Notificaciones configuradas en %s (%s).\n' "$SERVICE" "$REGION"
