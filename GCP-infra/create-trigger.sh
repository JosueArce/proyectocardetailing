#!/usr/bin/env sh
set -eu

PROJECT_ID="${PROJECT_ID:?Define PROJECT_ID con el ID de tu proyecto de GCP}"
REGION="${REGION:-us-central1}"
GITHUB_OWNER="${GITHUB_OWNER:-JosueArce}"
GITHUB_REPO="${GITHUB_REPO:-proyectocardetailing}"
TRIGGER_NAME="${TRIGGER_NAME:-deploy-main-cloud-run}"
BUILD_SA_NAME="${BUILD_SA_NAME:-estudio-auto-builder}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-estudio-auto-calendar}"
REPOSITORY="${REPOSITORY:-car-detailing}"
BUILD_SA="$BUILD_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
RUNTIME_SA="$RUNTIME_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com calendar-json.googleapis.com

gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION"

for account in "$BUILD_SA_NAME" "$RUNTIME_SA_NAME"; do
  gcloud iam service-accounts describe "$account@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 || \
    gcloud iam service-accounts create "$account" --display-name="$account"
done

for role in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter roles/storage.objectViewer roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="$role" \
    --condition=None >/dev/null
done

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$BUILD_SA" \
  --role="roles/iam.serviceAccountUser" >/dev/null

if gcloud builds triggers describe "$TRIGGER_NAME" --region="$REGION" >/dev/null 2>&1; then
  printf 'El trigger %s ya existe en %s; no se creó un duplicado.\n' "$TRIGGER_NAME" "$REGION"
else
  gcloud builds triggers create github \
    --name="$TRIGGER_NAME" \
    --region="$REGION" \
    --repo-owner="$GITHUB_OWNER" \
    --repo-name="$GITHUB_REPO" \
    --branch-pattern='^main$' \
    --build-config='GCP-infra/cloudbuild.yaml' \
    --service-account="projects/$PROJECT_ID/serviceAccounts/$BUILD_SA" \
    --description='Construye y despliega Cloud Run después de cada merge en main'
fi

printf '\nTrigger configurado:\n'
gcloud builds triggers describe "$TRIGGER_NAME" \
  --region="$REGION" \
  --format='yaml(name,github,filename,serviceAccount)'
