# ── Secret Manager secrets ──────────────────────────────────────────
resource "google_secret_manager_secret" "db_url" {
  secret_id = "valerie-db-url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_url" {
  secret      = google_secret_manager_secret.db_url.id
  secret_data = var.supabase_db_url
}

resource "google_secret_manager_secret" "master_key" {
  secret_id = "valerie-master-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "master_key" {
  secret      = google_secret_manager_secret.master_key.id
  secret_data = var.valerie_master_key
}

resource "google_secret_manager_secret" "api_key_salt" {
  secret_id = "valerie-api-key-salt"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "api_key_salt" {
  secret      = google_secret_manager_secret.api_key_salt.id
  secret_data = var.api_key_salt
}
