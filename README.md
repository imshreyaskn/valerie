# Valerie: Automated Red-Teaming Framework

**Valerie** is a modular, extensible framework designed for the automated safety evaluation and red-teaming of Large Language Models (LLMs). It provides a structured pipeline for generating adversarial attacks, querying target models, and analyzing responses for risks like PII leakage, bias, and toxicity.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- AWS Account (with Bedrock access enabled)
- Mistral AI API Key

### 2. Installation
Clone the repository and install the unified dependencies:
```bash
pip install -r requirements.txt
```

### 3. Configuration
Copy the template and fill in your credentials:
```bash
cp .env.example .env  # Or edit the existing .env
```
> [!IMPORTANT]
> The application will fail with a `FATAL CONFIGURATION ERROR` if `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `MISTRAL_API_KEY` are missing.

### 4. Running the Pipeline
Execute the main automation orchestrator:
```bash
$env:PYTHONPATH="src"
python -m valerie.automation.pipeline
```

---

## 📂 Project Structure

```text
Valerie/
├── src/
│   └── valerie/
│       ├── core/           # Configuration, Settings, and Base Classes
│       ├── automation/     # Red-Teaming Engine (DataLoader, Generator, Evaluator)
│       └── agents/         # Domain Agents (e.g., Selene Agent)
├── resources/              # Datasets, Prompt Templates, and Baseline CSVs
├── experiments/            # Archived developmental versions (Alpha/Beta/Gamma)
├── outputs/                # Generated evaluation reports and logs
├── .env                    # Unified environment configuration
└── requirements.txt        # Consolidated project dependencies
```

---

## 🛠 Core Components

### 🛡️ Automation Engine (`valerie.automation`)
- **Pipeline**: Orchestrates the 5-step red-teaming flow.
- **Generator**: Handles robust LLM interactions with exponential backoff and retry logic.
- **Evaluator**: Uses a "Judge" LLM to score responses against safety criteria (PII, Bias, Toxicity).
- **DataLoader**: Manages adversarial prompt datasets and jailbreak templates.

### 🤖 Specialized Agents (`valerie.agents`)
- **Selene Agent**: A Mistral-powered agent designed for structured output and safety testing.

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
