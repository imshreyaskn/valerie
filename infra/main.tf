terraform {
  required_version = ">= 1.7"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.33"
    }
  }

  # Uncomment after creating the GCS bucket below
  backend "gcs" {
    bucket = "valerie-redteam-tf-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Enable required APIs ────────────────────────────────────────────
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudtasks.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# ── GCS bucket for Terraform remote state ──────────────────────────
resource "google_storage_bucket" "tf_state" {
  name          = "${var.project_id}-tf-state"
  location      = var.region
  force_destroy = false

  versioning {
    enabled = true
  }

  uniform_bucket_level_access = true

  depends_on = [google_project_service.apis]
}
