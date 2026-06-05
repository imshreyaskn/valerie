# ── Artifact Registry repository ───────────────────────────────────
resource "google_artifact_registry_repository" "valerie" {
  location      = var.region
  repository_id = "valerie"
  description   = "Valerie container images"
  format        = "DOCKER"

  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "delete-old-images"
    action = "DELETE"
    condition {
      tag_state  = "ANY"
      older_than = "259200s" # 3 days
    }
  }

  depends_on = [google_project_service.apis]
}
