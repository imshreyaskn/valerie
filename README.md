<div align="center">
  <a href="https://valerie.vercel.app">
    <img src="assets/logo.png" alt="Valerie Logo" width="180" />
  </a>
  <br />
  <h1><a href="https://valerie.vercel.app">Valerie</a></h1>
  <p><b>Automated LLM Red-Teaming Framework</b></p>
</div>

---

**Valerie** is a modular, client/server framework designed for the automated safety evaluation and red-teaming of Large Language Models (LLMs). Powered by a FastAPI backend and a LangGraph execution engine, it provides a structured pipeline for generating adversarial attacks, querying target models, and analyzing responses for risks like PII leakage, bias, and toxicity.

## 💻 CLI Documentation

The `valerie` command-line tool acts as the control center for your red-teaming operations. It communicates securely with the backend API to dispatch attacks and stream results.

### `valerie init`
Initializes your local environment. Run this once after installation. It will launch an interactive wizard asking for your deployed **Backend URL** and the corresponding **API Key**. Credentials are saved securely to `~/.valerie/config.json`.

### `valerie validate`
Pings your target LLM provider to ensure your API keys are valid before launching a massive pipeline.
```bash
valerie validate --model mistral/mistral-small-latest --key <YOUR_MISTRAL_KEY>
```

### `valerie run`
The primary command to launch a red-team evaluation pipeline.

| Option | Required | Description |
|--------|----------|-------------|
| `--domain`, `-d` | Yes | The regulatory domain to test. (*Options: general, bfsi, healthcare, pharmacy, legal, hr, ecommerce*) |
| `--target-model` | Yes | The LiteLLM model identifier for the victim model. |
| `--target-key` | Yes | API key for the target model provider. |
| `--attacker-model` | No | Overrides the default model used to generate attacks. |
| `--judge-model` | No | Overrides the default model used to evaluate breakthrough risks. |
| `--concurrency`, `-c` | No | Max parallel workers. **Set to `1`** if you are using free-tier APIs to avoid rate limits. |
| `--harm-types` | No | Specific harm type to restrict the test to (e.g., `"False Information"`). |
| `--techniques` | No | Specific technique to restrict the test to (e.g., `"role_play"`). |

**Example Command:**
```bash
valerie run \
  --domain bfsi \
  --target-model mistral/mistral-small-latest \
  --target-key <YOUR_MISTRAL_KEY> \
  --concurrency 1
```

### `valerie runs results <RUN_ID>`
Fetches the final evaluation metrics from the database and renders a beautiful terminal UI matrix showing the PII leakage, Toxicity flags, and Risk Scores for every single attack payload generated during the run.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- AWS Account (with Bedrock access enabled)
- Mistral AI API Key

### 2. Installation
Clone the repository, install the backend dependencies, and install the CLI globally:
```bash
pip install -r requirements.txt
pip install -e ./cli
```

### 3. Backend Configuration
Copy the template and fill in your credentials (like `DATABASE_URL` and your API keys):
```bash
cp .env.example .env
```
> [!IMPORTANT]
> To run the backend locally or deploy it, make sure your `.env` is fully populated. To use the CLI, you must first run `valerie init` to authenticate with your backend.

---

## 📂 Project Structure

```text
Valerie/
├── cli/                    # The `valerie` command-line interface
├── src/
│   └── valerie/
│       ├── api/            # FastAPI backend routers and server
│       ├── graph/          # LangGraph execution pipeline
│       ├── db/             # SQLModel database schemas
│       ├── llm/            # LiteLLM routing with Tenacity backoff
│       └── attacks/        # Adversarial techniques and prompts
├── deploy/                 # Deployment scripts for Google Cloud Run
├── resources/              # Datasets, Prompt Templates, and Baseline CSVs
├── outputs/                # Generated evaluation reports and logs
├── .env                    # Unified environment configuration
└── requirements.txt        # Consolidated project dependencies
```

---

## 🛠 Core Components

### 🛡️ Backend Architecture (`valerie.api` & `valerie.graph`)
- **FastAPI**: Provides endpoints for the CLI to dispatch runs and stream results.
- **LangGraph**: Orchestrates the adversarial generation, targeting, and judging logic asynchronously.
- **Tenacity + LiteLLM**: Handles resilient, rate-limit-aware LLM API calls with exponential backoff.

### 💻 Client CLI (`cli/`)
- **Typer & Rich**: Provides a beautiful, interactive terminal UI for launching attacks, tracking progress, and viewing vulnerability reports.

---

## ⚙️ Advanced Configuration

Configuration is managed via **Pydantic Settings** in `valerie/core/settings.py`. 

- **Environment Isolation**: Easily switch between `development`, `staging`, and `production`.
- **Fail-Fast Validation**: The application validates all environment variables at startup to prevent runtime crashes.
- **Customizable Timeouts**: Tune `LLM_TIMEOUT_SECONDS` and `ATTACK_MAX_ITERATIONS` for complex attack refinement.

---

## 📜 Archival
All legacy research and experimental scripts have been moved to the `experiments/` directory. This ensures the production-ready package in `src/` remains clean while preserving developmental history.

---

## 📧 Support
Developed by **Shreyas** (imshreyaskn@gmail.com).
