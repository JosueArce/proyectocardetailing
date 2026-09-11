#!/usr/bin/env sh
set -eu

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID}"
REGION="${REGION:-us-west1}"
SERVICE="${SERVICE:-proyectocardetailing}"
RUNTIME_SA="${RUNTIME_SA:-estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-josue.arce.gonzalez@gmail.com}"
: "${ADMIN_PASSWORD:?Define ADMIN_PASSWORD}"
: "${SESSION_SECRET:?Define SESSION_SECRET con al menos 32 caracteres aleatorios}"

if [ "${#SESSION_SECRET}" -lt 32 ]; then
  printf 'SESSION_SECRET debe contener al menos 32 caracteres.\n' >&2
  exit 2
fi

gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"
put_secret() {
  name="$1"; value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    printf %s "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID" >/dev/null
  else
    printf %s "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- --project="$PROJECT_ID" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" --project="$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" --role=roles/secretmanager.secretAccessor >/dev/null
}

put_secret autoestudio-admin-password "$ADMIN_PASSWORD"
put_secret autoestudio-session-secret "$SESSION_SECRET"

gcloud run services update "$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
  --update-secrets="ADMIN_PASSWORD=autoestudio-admin-password:latest,SESSION_SECRET=autoestudio-session-secret:latest" \
  --update-env-vars="ADMIN_EMAIL=$ADMIN_EMAIL"

printf 'Acceso administrativo configurado en %s (%s).\n' "$SERVICE" "$REGION"
