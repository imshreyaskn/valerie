# Valerie — GCP Infrastructure (Terraform)

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.7
2. [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated
3. A [Supabase](https://supabase.com) project created (free tier is fine)
4. A GCP billing account attached to your GCP account

---

## Step 1 — Create a GCP Project

```bash
gcloud projects create valerie-redteam --name="Valerie Red Team"
gcloud config set project valerie-redteam

# Link billing account (find your billing account ID first)
gcloud billing accounts list
gcloud billing projects link valerie-redteam --billing-account=XXXXXXX-XXXXXX-XXXXXX
```

---

## Step 2 — Authenticate Terraform

```bash
gcloud auth application-default login
```

---

## Step 3 — Get your Supabase connection string

1. Go to your Supabase project → **Settings → Database**
2. Under **Connection string**, choose **Transaction mode** (port 6543)
3. Copy the URI — it looks like:
   ```
   postgres://postgres.[ref]:[password]@[host]:6543/postgres
   ```
4. Change `postgres://` → `postgresql+asyncpg://`

---

## Step 4 — Configure variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

Required values in `terraform.tfvars`:
```hcl
project_id         = "valerie-redteam"
supabase_db_url    = "postgresql+asyncpg://postgres.[ref]:[password]@[host]:6543/postgres"
valerie_master_key = "$(openssl rand -hex 32)"
api_key_salt       = "$(openssl rand -hex 16)"
```

---

## Step 5 — Bootstrap infrastructure

```bash
cd infra/
terraform init
terraform plan    # review what will be created
terraform apply   # provision everything (~2-3 minutes)
```

**What gets created:**
- GCS bucket for Terraform state
- Artifact Registry Docker repository
- Cloud Tasks queue (`valerie-pipeline-queue`)
- Secret Manager secrets (db_url, master_key, api_key_salt)
- Service accounts + IAM bindings
- Cloud Run: `valerie-api` (public)
- Cloud Run: `valerie-worker` (private, internal only)

**Outputs after apply:**
```
api_url         = "https://valerie-api-xxxx-uc.a.run.app"
worker_url      = "https://valerie-worker-xxxx-uc.a.run.app"
registry_url    = "us-central1-docker.pkg.dev/valerie-redteam/valerie"
```

---

## Step 6 — Enable remote state (optional but recommended)

After first `apply`, the GCS bucket exists. Enable remote state:

1. Uncomment the `backend "gcs"` block in `main.tf`
2. Run `terraform init -migrate-state`

---

## Step 7 — Set up GitHub Actions secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `GCP_PROJECT_ID` | `valerie-redteam` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | See below |
| `GCP_SERVICE_ACCOUNT` | `valerie-cloudrun@valerie-redteam.iam.gserviceaccount.com` |
| `SUPABASE_DB_URL` | Your Supabase connection string |

**Workload Identity Federation (keyless auth):**
```bash
# Create WIF pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" --display-name="GitHub Actions Pool"

# Create WIF provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  valerie-cloudrun@valerie-redteam.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USER/valerie"

# Get the provider resource name (use this as GCP_WORKLOAD_IDENTITY_PROVIDER)
gcloud iam workload-identity-pools providers describe github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

---

## Step 8 — First deploy

Push to `main` to trigger the GitHub Actions deploy workflow:
```bash
git push origin main
```

The workflow will:
1. Build the Docker image
2. Push to Artifact Registry
3. Deploy `valerie-api` and `valerie-worker` to Cloud Run
4. Run Alembic migrations against Supabase

---

## Step 9 — Release the CLI

Tag a release to trigger binary builds:
```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will build `valerie` binaries for Linux, macOS, and Windows and attach them to the GitHub Release automatically.

---

## Teardown

```bash
terraform destroy
# Also manually delete the GCS tf state bucket if no longer needed
```
