locals {
  image_api    = "${var.region}-docker.pkg.dev/${var.project_id}/valerie/app:${var.image_tag}"
  image_worker = "${var.region}-docker.pkg.dev/${var.project_id}/valerie/app:${var.image_tag}"
}

# ── API Service (public) ────────────────────────────────────────────
resource "google_cloud_run_v2_service" "api" {
  name     = "valerie-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image   = local.image_api
      command = ["uvicorn"]
      args    = ["valerie.api.main:app", "--host", "0.0.0.0", "--port", "8080"]

      ports {
        container_port = 8080
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }

      env {
        name  = "PYTHONPATH"
        value = "/app/src"
      }

      env {
        name  = "WORKER_USE_CLOUD_TASKS"
        value = "true"
      }

      env {
        name  = "CLOUD_TASKS_QUEUE"
        value = google_cloud_tasks_queue.pipeline_queue.name
      }

      env {
        name  = "CLOUD_TASKS_LOCATION"
        value = var.region
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "WORKER_URL"
        value = "${google_cloud_run_v2_service.worker.uri}/internal/run"
      }

      # Secrets mounted from Secret Manager
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "VALERIE_MASTER_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.master_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "API_KEY_SALT"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.api_key_salt.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.valerie,
    google_project_iam_member.secret_accessor,
  ]
}

# Allow unauthenticated access to API
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Worker Service (private, Cloud Tasks only) ──────────────────────
resource "google_cloud_run_v2_service" "worker" {
  name     = "valerie-worker"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun_sa.email

    # Workers need more time — LLM calls take 30-60s each
    timeout = "900s"

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image   = local.image_worker
      command = ["uvicorn"]
      args    = ["valerie.worker.executor:app", "--host", "0.0.0.0", "--port", "8080"]

      ports {
        container_port = 8080
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }

      env {
        name  = "PYTHONPATH"
        value = "/app/src"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.valerie,
    google_project_service.apis,
  ]
}
