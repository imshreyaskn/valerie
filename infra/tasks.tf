# ── Cloud Tasks queue ───────────────────────────────────────────────
resource "google_cloud_tasks_queue" "pipeline_queue" {
  name     = "valerie-pipeline-queue"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts  = 3
    min_backoff   = "10s"
    max_backoff   = "300s"
    max_doublings = 4
  }

  depends_on = [google_project_service.apis]
}
