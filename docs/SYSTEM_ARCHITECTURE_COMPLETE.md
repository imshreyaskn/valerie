# System Architecture

## Overview

Valerie is a **production-grade automated LLM red teaming and forensic system** designed for enterprise AI safety evaluation. The architecture follows event-driven microservices patterns with strong consistency guarantees and forensic integrity.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Web UI     │  │   CLI Tool   │  │  REST API    │                  │
│  │  (React)     │  │   (Typer)    │  │  Clients     │                  │
│  │  Port 5173   │  │              │  │              │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                 │                           │
│         └─────────────────┴─────────────────┘                           │
│                           │                                             │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │ HTTPS/WebSocket
┌───────────────────────────▼─────────────────────────────────────────────┐
│                         API GATEWAY                                      │
│                    FastAPI Backend (Port 8080)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Authentication │ Authorization │ Rate Limiting │ Input Validation      │
│  - API Keys     │ RBAC          │ Token Bucket  │ Schema Validation     │
│  - JWT Tokens   │ Owner Checks  │ Per-Endpoint  │ Template Sanitization │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼───────┐  ┌────────▼────────┐
│  Event Bus     │  │  Execution   │  │   Intelligence  │
│  (Redis Pub/Sub)│  │  Engine      │  │   Pipeline      │
│                │  │  (LangGraph) │  │                 │
│  - run.started │  │  - Attack    │  │  - Clustering   │
│  - task.*      │  │    Worker    │  │  - Anomaly Det. │
│  - judge.*     │  │  - Judge     │  │  - Coverage     │
│  - response.*  │  │    Evaluator │  │                 │
└───────┬────────┘  └──────┬───────┘  └────────┬────────┘
        │                  │                   │
        └──────────────────┼───────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────────────┐
│                      DATA PERSISTENCE LAYER                             │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│  │   MongoDB        │  │   Redis          │  │  Forensic Ledger    │  │
│  │   (Primary DB)   │  │   (Cache/Queue)  │  │  (Immutable Hash)   │  │
│  │                  │  │                  │  │                     │  │
│  │ - pipeline_runs  │  │ - Event streams  │  │ - Content hashes    │  │
│  │ - eval_results   │  │ - Session cache  │  │ - Chain of custody  │  │
│  │ - intelligence   │  │ - Rate limits    │  │ - Audit trail       │  │
│  │ - users/endpoints│  │ - Task queue     │  │ - Tamper evidence   │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Dashboard (`/frontend`)
**Technology**: React 18 + Vite + TypeScript + Tailwind CSS

**Key Features**:
- **Mission Control**: Real-time campaign monitoring with live SSE updates
- **Graph Visualization**: Interactive node graphs showing attack chains (React Flow)
- **Intelligence Feed**: Clustering analysis and anomaly detection visualizations
- **Results Matrix**: Color-coded risk assessment tables with export capabilities

**Architecture**:
- Component-based design with reusable UI primitives
- Zustand for state management (pipeline store, workspace store)
- Server-Sent Events (SSE) for real-time updates
- Responsive design with mobile support

### 2. API Server (`src/valerie/api`)
**Technology**: FastAPI + Uvicorn

**Responsibilities**:
- RESTful API endpoints for all operations
- Authentication & authorization (API keys, JWT)
- Request validation and rate limiting
- Event publishing to Redis
- Health checks and metrics exposure

**Security Features**:
- Constant-time API key comparison (prevents timing attacks)
- Rate limiting with exponential backoff
- Input sanitization for custom templates
- Structured logging without sensitive data leakage

### 3. Execution Engine (`src/valerie/graph`)
**Technology**: LangGraph + AsyncIO

**Pipeline Stages**:
1. **Config Node**: Load domain prompts and validate configuration
2. **Technique Node**: Select attack techniques based on harm types
3. **Task Node**: Generate adversarial prompts with mutations
4. **Mutation Node**: Refine prompts based on judge feedback
5. **Outcome Node**: Aggregate results and compute metrics

**State Management**:
- Type-safe `PipelineState` TypedDict
- Immutable state transitions
- Confidence tracking for parsed evaluations

### 4. Worker Service (`src/valerie/worker`)
**Technology**: FastAPI + AsyncIO

**Responsibilities**:
- Execute pipeline tasks from queue
- Call external LLM APIs (Mistral, OpenAI, etc.)
- Publish events for each execution stage
- Handle retries with exponential backoff

**Reliability Features**:
- Circuit breaker pattern for LLM calls
- Dead letter queue for failed tasks
- Graceful shutdown with task completion

### 5. Intelligence Pipeline (`src/valerie/intelligence`)
**Technology**: Scikit-learn + NumPy

**Analysis Capabilities**:
- **Clustering**: DBSCAN algorithm groups similar attacks
- **Anomaly Detection**: Isolation Forest identifies outliers
- **Coverage Analysis**: Tracks domain and technique coverage
- **Pattern Recognition**: Identifies systematic vulnerabilities

**Consumer Pattern**:
- Async event consumer loops
- Error tracking with circuit breakers
- Dead letter queue integration

### 6. Knowledge Base (`src/valerie/knowledge`)
**Technology**: Sentence Transformers + FAISS

**Features**:
- Embedding generation for prompts/responses
- Vector similarity search
- Semantic clustering of findings
- Cross-campaign knowledge retrieval

### 7. Learning Loop (`src/valerie/learning`)
**Technology**: Pydantic + AsyncIO

**Purpose**:
- Analyze low-confidence evaluations
- Update attack strategy genome
- Improve prompt mutation heuristics
- Feedback loop for continuous improvement

### 8. Forensics Module (`src/valerie/forensics`)
**Technology**: hashlib + Cryptographic libraries

**Capabilities**:
- SHA-256 content hashing
- Tamper-evident storage
- Chain of custody tracking
- Immutable audit log with hash chains

**Forensic Integrity**:
- Every prompt/response hashed on ingestion
- Hash verification before analysis
- Provenance metadata for derived data
- WORM (Write-Once-Read-Many) compliance ready

## Data Flow

### Campaign Execution Flow

```
1. User creates campaign via UI/CLI
           │
2. API validates & persists run config
           │
3. Publisher emits "run.started" event
           │
4. ┌──────────────────────────────┐
   │  Consumer Loops (Parallel)   │
   ├──────────────────────────────┤
   │ Knowledge: Index embeddings  │
   │ Intelligence: Cluster track  │
   │ Learning: Genome update      │
   └──────────────────────────────┘
           │
5. Execution engine dispatches tasks
           │
6. For each task (concurrent):
   ├─ Generate adversarial prompt
   ├─ Call target LLM API
   ├─ Receive response
   ├─ Judge evaluates breakthrough
   └─ Publish task.completed
           │
7. Aggregator collects all results
           │
8. Emit "run.completed" with summary
           │
9. Update MongoDB with final status
```

### Event Schema

All events follow a consistent schema:

```python
class Event(BaseModel):
    type: str              # e.g., "task.completed"
    source: str            # e.g., "execution.attack_worker"
    correlation_id: str    # Run ID for tracing
    timestamp: datetime    # UTC timestamp
    payload: dict          # Event-specific data
    schema_version: str    # For forward compatibility
```

## Security Architecture

### Authentication
- **API Keys**: HMAC-signed with per-user salts
- **JWT Tokens**: Short-lived access tokens for UI
- **Master Key**: Protects all cryptographic operations

### Authorization
- **Owner Checks**: Users can only access their own resources
- **RBAC Ready**: Role-based access control framework in place
- **Fine-Grained Permissions**: Per-endpoint authorization

### Data Protection
- **Encryption at Rest**: MongoDB encryption enabled
- **Encryption in Transit**: TLS for all external communication
- **Secret Management**: No hardcoded secrets (fail-fast validation)

### Forensic Security
- **Content Hashing**: SHA-256 for all prompts/responses
- **Hash Chains**: Each audit entry links to previous
- **Tamper Detection**: Verification API detects modifications
- **Immutable Ledger**: Append-only audit log design

## Deployment Architecture

### Docker Compose (Development)
```yaml
services:
  - frontend (Port 5173)
  - api (Port 8080)
  - worker (Port 8081)
  - mongodb (Port 27017)
  - redis (Port 6379)
```

### Production (GCP Cloud Run)
- **Containerized Services**: API and Worker as separate Cloud Run services
- **Cloud Tasks**: Managed queue for task distribution
- **Secret Manager**: GCP Secret Manager for credentials
- **Cloud Monitoring**: Integrated logging and alerting
- **VPC Network**: Private networking for database access

## Scalability Considerations

### Horizontal Scaling
- **Stateless API**: Any instance can handle any request
- **Worker Pool**: Add workers to increase throughput
- **Redis Cluster**: Scale event bus for high volume
- **MongoDB Sharding**: Partition data by user or campaign

### Performance Optimizations
- **Connection Pooling**: MongoDB (50 max, 5 min), Redis pooled
- **Async I/O**: Non-blocking database and LLM calls
- **Caching**: Redis cache for frequently accessed data
- **Batch Operations**: Bulk inserts for evaluation results

### Concurrency Control
- **Semaphores**: Limit concurrent LLM API calls
- **Rate Limiting**: Token bucket per API key
- **Task Queues**: Ordered processing with priority support

## Monitoring & Observability

### Health Checks
- `/health` endpoint returns comprehensive status
- Checks MongoDB, Redis, and consumer health
- Returns 503 if any critical dependency unhealthy

### Logging
- Structured JSON logging
- Correlation IDs for request tracing
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

### Metrics (Future)
- Prometheus metrics endpoint planned
- Key metrics: task latency, breakthrough rates, error rates
- Alerting thresholds for operational issues

## Compliance Alignment

### NIST AI Risk Management Framework
- **Map**: Domain-specific prompt libraries
- **Measure**: Quantitative risk scoring
- **Manage**: Configurable harm type targeting
- **Govern**: Audit trails and forensic evidence

### SOC 2 Type II
- **Security**: Authentication, authorization, encryption
- **Availability**: Health checks, graceful degradation
- **Confidentiality**: Data isolation by user
- **Privacy**: PII detection and redaction

### GDPR
- **Data Minimization**: Only collect necessary data
- **Right to Erasure**: User deletion cascades to all data
- **Audit Trail**: Track all data access and modifications

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, Vite, TypeScript | Interactive dashboard |
| Styling | Tailwind CSS | Responsive UI |
| Visualization | React Flow | Graph diagrams |
| State Mgmt | Zustand | Client-side state |
| Backend | FastAPI, Python 3.12 | REST API server |
| Execution | LangGraph | Pipeline orchestration |
| Database | MongoDB 6 | Primary data store |
| Cache/Queue | Redis 7 | Event bus, caching |
| LLM Router | LiteLLM | Multi-provider support |
| Resilience | Tenacity | Retry logic |
| ML/Analysis | Scikit-learn, NumPy | Clustering, anomaly detection |
| Embeddings | Sentence Transformers | Semantic search |
| Forensics | hashlib (SHA-256) | Content hashing |
| Deployment | Docker, GCP Cloud Run | Container orchestration |

## Future Roadmap

### Phase 1 (Q1 2025)
- [ ] Prometheus metrics integration
- [ ] Distributed tracing with Jaeger
- [ ] Chaos engineering test suite
- [ ] Multi-region deployment support

### Phase 2 (Q2 2025)
- [ ] Blockchain anchoring for forensic ledger
- [ ] Zero-knowledge proofs for privacy-preserving analysis
- [ ] Automated mitigation recommendations
- [ ] Integration with SIEM systems

### Phase 3 (Q3 2025)
- [ ] Federated learning across deployments
- [ ] Adversarial attack marketplace
- [ ] Real-time collaboration features
- [ ] Advanced threat simulation scenarios
