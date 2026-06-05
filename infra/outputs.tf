output "api_url" {
  description = "Public URL for the Valerie API (use this in valerie CLI init)"
  value       = google_cloud_run_v2_service.api.uri
}

output "worker_url" {
  description = "Internal URL for the Valerie Worker (used by Cloud Tasks)"
  value       = google_cloud_run_v2_service.worker.uri
}

output "registry_url" {
  description = "Artifact Registry base URL for Docker pushes"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/valerie"
}

output "tf_state_bucket" {
  description = "GCS bucket for Terraform remote state"
  value       = google_storage_bucket.tf_state.name
}
