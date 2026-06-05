variable "project_id" {
  type        = string
  description = "GCP Project ID (create one in the GCP console first)"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "GCP region for all resources"
}

variable "supabase_db_url" {
  type        = string
  sensitive   = true
  description = "Supabase PostgreSQL connection string (port 6543, transaction mode). Format: postgresql+asyncpg://postgres.[ref]:[password]@[host]:6543/postgres"
}

variable "valerie_master_key" {
  type        = string
  sensitive   = true
  description = "Master API key for the Valerie platform (generate a random 32-char string)"
}

variable "api_key_salt" {
  type        = string
  sensitive   = true
  description = "Salt for bcrypt API key hashing"
}

variable "mistral_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Default platform Mistral API key (optional — users BYOK)"
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Docker image tag to deploy"
}
