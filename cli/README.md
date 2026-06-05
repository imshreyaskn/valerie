# Valerie CLI

Bring-Your-Own-Key CLI for the [Valerie LLM Red-Teaming Platform](https://github.com/imshreyaskn/valerie).

## Install

### Download Binary (Recommended)

Download the latest binary from [GitHub Releases](https://github.com/imshreyaskn/valerie/releases):

**Linux/macOS:**
```bash
curl -L https://github.com/imshreyaskn/valerie/releases/latest/download/valerie-linux-amd64 -o valerie
chmod +x valerie && sudo mv valerie /usr/local/bin/
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "https://github.com/imshreyaskn/valerie/releases/latest/download/valerie-windows-amd64.exe" -OutFile valerie.exe
```

### From Source
```bash
pip install ./cli
```

## Setup

```bash
valerie init
# Enter your Valerie backend URL and API key
```

## Usage

### Validate a target model endpoint
```bash
valerie validate --model mistral/mistral-small-latest --key $MISTRAL_KEY
valerie validate --model openai/gpt-4o --key $OPENAI_KEY
valerie validate --model openai/custom --key $KEY --base http://localhost:11434/v1
```

### Launch a red-team run
```bash
# Basic run against BFSI domain
valerie run \
  --domain bfsi \
  --target-model mistral/mistral-small-latest \
  --target-key $MISTRAL_KEY

# Advanced: specific harm types and techniques, separate attacker/judge keys
valerie run \
  --domain healthcare \
  --harm-types "Harmful Medical Advice" "Drug Abuse Enablement" \
  --techniques indirect_prompting role_play obfuscation \
  --target-model gpt-4o \
  --target-key $OPENAI_KEY \
  --attacker-model mistral/mistral-large-latest \
  --attacker-key $MISTRAL_KEY \
  --judge-model mistral/mistral-large-latest \
  --judge-key $MISTRAL_KEY \
  --threshold 0.7 \
  --max-iterations 3

# Launch without waiting (fire and forget)
valerie run --domain bfsi --target-model gpt-4o --target-key $OPENAI_KEY --no-wait
```

### View results
```bash
valerie runs list
valerie runs status <run-id>
valerie runs results <run-id>
valerie runs results <run-id> --show-prompts
valerie runs results <run-id> --min-score 0.7 --export report.json
```

### Configure defaults
```bash
valerie config show
valerie config set defaults.max_iterations 5
valerie config set defaults.risk_threshold 0.8
```

## BYOK — Which keys go where?

| Key | Usage | Stored? |
|-----|-------|---------|
| Valerie API key | Authenticates with the backend | `~/.valerie/config.json` |
| Target LLM key | Tests the model being red-teamed | Sent per-request, never stored |
| Attacker LLM key | Generates adversarial prompts | Sent per-request, never stored |
| Judge LLM key | Evaluates target responses | Sent per-request, never stored |

All LLM keys are sent directly in the run payload and are never persisted on the server.
