# ── Service account for Cloud Run services ──────────────────────────
resource "google_service_account" "cloudrun_sa" {
  account_id   = "valerie-cloudrun"
  display_name = "Valerie Cloud Run Service Account"
  depends_on   = [google_project_service.apis]
}

# Allow Cloud Run SA to access Secret Manager
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow Cloud Run SA to push Docker images to Artifact Registry
resource "google_project_iam_member" "artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow Cloud Run SA to deploy Cloud Run services (needed by GitHub Actions)
resource "google_project_iam_member" "run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow Cloud Run SA to enqueue Cloud Tasks
resource "google_project_iam_member" "tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow Cloud Run SA to invoke the worker (private Cloud Run)
resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Allow the SA to impersonate itself (needed for gcloud run deploy --service-account)
resource "google_service_account_iam_member" "self_act_as" {
  service_account_id = google_service_account.cloudrun_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}
