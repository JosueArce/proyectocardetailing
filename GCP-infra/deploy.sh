#!/usr/bin/env sh
set -eu

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID con el ID de tu proyecto de GCP}"
REGION="${REGION:-us-west1}"
REPOSITORY="${REPOSITORY:-car-detailing}"
SERVICE="${SERVICE:-proyectocardetailing}"
COMMIT_SHA="$(git rev-parse HEAD)"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com calendar-json.googleapis.com
gcloud iam service-accounts describe "estudio-auto-calendar@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 || \
  gcloud iam service-accounts create estudio-auto-calendar --display-name="Estudio Auto Calendar"
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION"
gcloud builds submit --config GCP-infra/cloudbuild.yaml --project "$PROJECT_ID" \
  --substitutions "COMMIT_SHA=$COMMIT_SHA,_REGION=$REGION,_REPOSITORY=$REPOSITORY,_SERVICE=$SERVICE" .

printf '\nAplicación desplegada en:\n'
gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
