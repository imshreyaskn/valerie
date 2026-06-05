#!/bin/bash
PROJECT_ID="valerie-redteam"
REGION="us-central1"

gcloud config set project $PROJECT_ID

# Enable services
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# Create Cloud Tasks queue
gcloud tasks queues create valerie-pipeline-queue \
  --location=$REGION \
  --max-concurrent-dispatches=10 \
  --max-attempts=3

# Deploy API service
gcloud run deploy valerie-api \
  --source .. \
  --region=$REGION \
  --allow-unauthenticated \
  --set-env-vars="WORKER_URL=https://valerie-worker-xxxx-uc.a.run.app" \
  --command="uvicorn" \
  --args="valerie.api.main:app,--host,0.0.0.0,--port,8080"

# Deploy Worker service (no public access)
gcloud run deploy valerie-worker \
  --source .. \
  --region=$REGION \
  --no-allow-unauthenticated \
  --command="uvicorn" \
  --args="valerie.worker.executor:app,--host,0.0.0.0,--port,8080"

echo "✅ Deployed. Run Alembic migrations:"
echo "   PYTHONPATH=src python -m alembic upgrade head"
