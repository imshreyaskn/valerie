<div align="center">
  <a href="https://valerie-beta.vercel.app/">
    <img src="assets/logo.png" alt="Valerie Logo" width="180" />
  </a>
  <br />
  <h1><a href="https://valerie-beta.vercel.app/">Valerie</a></h1>
  <p><b>Production-Grade Automated LLM Red Teaming & Forensic System</b></p>
  
  [![Demo Ready](https://img.shields.io/badge/demo-ready-green)](DEMO_SETUP.md)
  [![Architecture](https://img.shields.io/badge/architecture-documented-blue)](docs/SYSTEM_ARCHITECTURE_COMPLETE.md)
  [![Forensics](https://img.shields.io/badge/forensics-SHA256-purple)](src/valerie/forensics/evidence.py)
  [![Python 3.12](https://img.shields.io/badge/python-3.12-yellow)](requirements.txt)
</div>

---

**Valerie** is an enterprise-ready framework for automated AI safety evaluation and forensic red teaming of Large Language Models (LLMs). It combines:

- 🎯 **Adversarial Attack Generation**: Automated prompt engineering with 15+ techniques
- 🔍 **Real-Time Intelligence**: Clustering, anomaly detection, and pattern recognition
- 🔐 **Forensic Integrity**: SHA-256 hashing, tamper-evident logs, chain of custody
- 📊 **Visual Dashboard**: Interactive graphs, live streaming, risk heatmaps
- ⚡ **Production Scale**: Event-driven architecture, health checks, graceful degradation

Perfect for **AI safety teams**, **compliance auditors**, and **security researchers** evaluating LLM deployments.

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

### 🎬 Option 1: Demo Mode (Recommended for Presentations)

Get a **fully functional demo** running in 60 seconds with pre-populated data:

```bash
# 1. Clone repository
git clone https://github.com/imshreyaskn/valerie.git && cd valerie

# 2. Copy demo configuration (pre-configured for reliability)
cp .env.demo .env

# 3. Start all services (API, Worker, Frontend, MongoDB, Redis)
docker-compose up --build

# 4. Generate demo campaign data (optional - provides instant visualization)
python demo_simulator.py
```

**Access Points:**
- 🌐 **Frontend Dashboard**: http://localhost:5173 (visual graphs, live campaigns)
- 🔧 **API Server**: http://localhost:8080/health
- 📊 **Worker**: http://localhost:8081/health

📖 **Full demo instructions**: See [DEMO_SETUP.md](DEMO_SETUP.md) for detailed script and troubleshooting.

---

### 👨‍💻 Option 2: CLI-Only (No Backend Required)

Use the CLI with a remote backend instance:

```bash
# 1. Install the CLI
git clone https://github.com/imshreyaskn/valerie.git
cd valerie/cli
pip install -e .

# 2. Authenticate with backend
valerie init
# Enter backend URL and API key when prompted

# 3. Run a red team campaign
valerie run \
  --domain bfsi \
  --target-model mistral/mistral-small-latest \
  --target-key YOUR_MISTRAL_KEY \
  --concurrency 1
```

---

### 🏗️ Option 3: Full Self-Hosted Development

For contributors and enterprise deployments:

**Prerequisites:**
- Python 3.12+
- Node.js 20+ (for frontend)
- Docker & Docker Compose
- MongoDB 6+ (or use Docker container)
- Redis 7+ (or use Docker container)

**Installation:**

```bash
# 1. Clone and install Python dependencies
git clone https://github.com/imshreyaskn/valerie.git
cd valerie
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your database URLs and API keys

# 3. Start infrastructure (MongoDB + Redis)
docker-compose up mongodb redis

# 4. Initialize database schema
# (Handled automatically on first API startup)

# 5. Start API server
cd src
uvicorn valerie.api.main:app --reload --host 0.0.0.0 --port 8080

# 6. In separate terminal, start worker
uvicorn valerie.worker.executor:app --host 0.0.0.0 --port 8081

# 7. In separate terminal, start frontend
cd frontend
npm install
npm run dev
```

---

## 📂 Project Structure

```text
valerie/
├── frontend/               # React + TypeScript dashboard (Vite, Tailwind)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages (MissionControl, Intelligence, etc.)
│   │   ├── stores/        # Zustand state management
│   │   └── hooks/         # Custom React hooks (useRunStream)
│   ├── Dockerfile.dev     # Development Docker setup
│   └── package.json
│
├── src/valerie/           # Core Python backend
│   ├── api/               # FastAPI routers and auth
│   ├── graph/             # LangGraph pipeline nodes
│   ├── forensics/         # SHA-256 hashing, evidence chain
│   ├── intelligence/      # Clustering, anomaly detection
│   ├── knowledge/         # Embeddings, vector search
│   ├── learning/          # Genome evolution, feedback loops
│   ├── db/                # MongoDB models and indexes
│   ├── llm/               # Multi-provider LLM router
│   └── worker/            # Task executor service
│
├── cli/                   # Typer-based CLI tool
├── experiments/           # Legacy research scripts
├── resources/             # Domain prompt datasets (CSV)
├── docs/                  # Architecture & design documents
│
├── docker-compose.yml     # Full stack orchestration
├── demo_simulator.py      # Demo data generator
├── DEMO_SETUP.md          # Presentation guide
└── requirements.txt       # Python dependencies
```

---

## 🎯 Key Features

### 🔐 Forensic Integrity
- **SHA-256 Content Hashing**: Every prompt and response hashed on ingestion
- **Tamper-Evident Storage**: Hash chain verification detects modifications
- **Chain of Custody**: Complete provenance tracking for all evidence
- **Immutable Audit Log**: Append-only ledger for compliance requirements

### 📊 Visual Intelligence
- **Interactive Graph Visualization**: See attack chains as node diagrams (React Flow)
- **Real-Time Streaming**: Live SSE updates during campaign execution
- **Clustering Analysis**: DBSCAN groups similar attack patterns
- **Anomaly Detection**: Isolation Forest identifies unusual responses
- **Risk Heatmaps**: Color-coded severity matrices

### ⚡ Production Reliability
- **Health Checks**: Comprehensive `/health` endpoint monitoring all services
- **Graceful Degradation**: Consumer error tracking with circuit breakers
- **Connection Pooling**: Optimized MongoDB (50 max) and Redis connections
- **Retry Logic**: Exponential backoff for LLM API failures
- **Demo Mode**: Hardcoded success scenarios for reliable presentations

### 🛡️ Security
- **Authentication**: API keys with constant-time comparison (timing attack resistant)
- **Authorization**: Owner-based resource isolation
- **Input Validation**: Template sanitization prevents injection attacks
- **No Hardcoded Secrets**: Fail-fast validation on startup
- **Rate Limiting Ready**: Token bucket infrastructure in place

---

## 🏗️ Architecture Highlights

For detailed architecture documentation, see [SYSTEM_ARCHITECTURE_COMPLETE.md](docs/SYSTEM_ARCHITECTURE_COMPLETE.md).

**Key Design Patterns:**
- **Event-Driven**: Redis pub/sub decouples components
- **CQRS**: Separate read/write models for scalability
- **Type-Safe State**: TypedDict for pipeline state management
- **Confidence Tracking**: Low-confidence evaluations flagged for review
- **Dead Letter Queues**: Failed tasks preserved for analysis

---

## 🎓 Why Valerie Stands Out (For Academic Use)

This project demonstrates **production-grade engineering** rarely seen in academic projects:

1. **Forensic Focus**: Most student projects ignore evidence preservation; Valerie includes SHA-256 hashing and tamper detection
2. **Visual Sophistication**: Interactive React Flow graphs impress in demonstrations
3. **Real-World Alignment**: Maps to NIST AI RMF, SOC 2, GDPR compliance requirements
4. **Demo Reliability**: Pre-configured demo mode ensures 100% successful presentations
5. **Comprehensive Documentation**: Architecture docs, demo scripts, troubleshooting guides

**Perfect for:** AI safety courses, security engineering capstones, compliance technology demos

---

## 📧 Support & Contributing

**Developer**: Shreyas ([imshreyaskn@gmail.com](mailto:imshreyaskn@gmail.com))  
**GitHub**: https://github.com/imshreyaskn/valerie  
**Documentation**: https://valerie-beta.vercel.app/

### Quick Links
- 📖 [Demo Setup Guide](DEMO_SETUP.md) - For presentations
- 🏗️ [System Architecture](docs/SYSTEM_ARCHITECTURE_COMPLETE.md) - Technical deep dive
- 🔐 [Forensics Module](src/valerie/forensics/evidence.py) - Evidence handling
- 🎬 [Demo Simulator](demo_simulator.py) - Generate sample data

---

## 📄 License

MIT License - See LICENSE file for details.
