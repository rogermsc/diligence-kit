# Diligence Kit Liaison Agent

Intelligent Customer Service and Support Agent for the Diligence Kit platform. Provides Level 2 support through AI-powered chat interactions, technical troubleshooting, and documentation-based assistance.

## Overview

The Liaison Agent uses LangGraph workflows and Google Vertex AI (Gemini 2.5 Flash) to provide intelligent support across three main categories:

- **Error Reports**: Technical troubleshooting with log analysis
- **How-To Questions**: Documentation-based support using RAG
- **General Chat**: Conversational assistance

## Technology Stack

- **Framework**: FastAPI
- **AI/ML**: LangChain, LangGraph, Google Vertex AI (Gemini 2.5 Flash)
- **Database**: PostgreSQL (with SQLAlchemy + Alembic)
- **Logging**: Google Cloud Logging
- **Language**: Python 3.10+
- **Package Manager**: Poetry

## Architecture

### Multi-Stage Agent Workflow

```
User Message → Router Node → [Ombudsman/Support/Response] → Final Response
```

1. **Router Node**: Classifies user intent (ERROR_REPORT, HOW_TO, CHITCHAT)
2. **Ombudsman Node**: Retrieves and analyzes logs from Google Cloud Logging
3. **Support Node**: Answers questions using SYSTEM_USER_GUIDE.md (RAG)
4. **Response Node**: Synthesizes final user-facing response

## API Endpoints

### Chat
```
POST /chat
Headers: X-API-Key
Body: { message, session_id?, user_id?, automation_id?, company_context? }
Response: { response, session_id }
```

### Session Management
```
GET /session/last?user_id={id}
POST /session/create
```

### Health Check
```
GET /health
```

## Environment Variables

```bash
API_KEY=your-api-key                           # Service authentication
GOOGLE_CLOUD_PROJECT_ID=your-project-id        # GCP project
GOOGLE_CLOUD_LOCATION=us-central1              # Vertex AI region
DATABASE_URL=postgresql+asyncpg://...          # PostgreSQL connection
ENV=dev|prod                                   # Environment
LOG_LEVEL=INFO                                 # Logging level
HOST=0.0.0.0                                   # Bind address
PORT=8000                                      # Service port
```

## Local Development

### Prerequisites
- Python 3.10+
- Poetry
- PostgreSQL
- Google Cloud credentials with Vertex AI and Logging access

### Setup

1. Install dependencies:
```bash
poetry install
```

2. Configure environment:
```bash
cp env.example .env
# Edit .env with your credentials
```

3. Run database migrations:
```bash
alembic upgrade head
```

4. Start the service:
```bash
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Docker Deployment

### Build Image
```bash
docker build -t diligence-kit-liaison-agent .
```

### Run Container
```bash
docker run -p 8000:8000 \
  --env-file .env \
  diligence-kit-liaison-agent
```

### Docker Compose
```bash
docker-compose up -d
```

## Kubernetes Deployment

### Prerequisites
- GKE cluster with Workload Identity enabled
- External Secrets Operator installed
- Secrets stored in Google Secret Manager

### Deploy to Production

1. Create secrets in Google Secret Manager:
```bash
# GCP secrets
gcloud secrets create diligence-kit-liaison-gcp-project-id-prod --data-file=-
gcloud secrets create diligence-kit-liaison-gcp-location-prod --data-file=-

# Database secrets
gcloud secrets create diligence-kit-liaison-database-url-prod --data-file=-

# App secrets
gcloud secrets create diligence-kit-liaison-api-key-prod --data-file=-
gcloud secrets create diligence-kit-liaison-env-prod --data-file=-
gcloud secrets create diligence-kit-liaison-log-level-prod --data-file=-
```

2. Apply Kubernetes manifests:
```bash
kubectl apply -f k8s/prod/service-account.yaml
kubectl apply -f k8s/prod/secrets.yaml
kubectl apply -f k8s/prod/service.yaml
kubectl apply -f k8s/prod/deployment.yaml
```

3. Verify deployment:
```bash
kubectl get pods -n prod -l app=diligence-kit-liaison-agent
kubectl logs -n prod -l app=diligence-kit-liaison-agent
```

### Build and Push Production Image

```bash
# Build for production
docker build -t us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:latest
```

## Database Migrations

### Create Migration
```bash
alembic revision --autogenerate -m "description"
```

### Apply Migrations
```bash
alembic upgrade head
```

### Rollback
```bash
alembic downgrade -1
```

## Integration

### From Frontend (diligence-kit-web)

```typescript
const response = await fetch('http://diligence-kit-liaison-agent:8000/chat', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.LIAISON_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "How do I upload documents?",
    session_id: sessionId,
    user_id: userId,
    automation_id: automationId  // Optional, for technical support
  })
});
```

### From Backend (diligence-kit-service)

```typescript
import { HttpService } from '@nestjs/axios';

const response = await this.httpService.post(
  'http://diligence-kit-liaison-agent:8000/chat',
  {
    message: userMessage,
    session_id: sessionId,
    user_id: userId,
    automation_id: automationId
  },
  {
    headers: { 'X-API-Key': process.env.LIAISON_API_KEY }
  }
).toPromise();
```

## Features

- **Intent Classification**: Automatically routes to appropriate handler
- **Log Analysis**: Retrieves and analyzes automation logs for troubleshooting
- **RAG Support**: Uses system documentation for accurate answers
- **Conversation Memory**: Maintains last 30 messages per session
- **Multi-language Input**: Accepts any language, always responds in English
- **Context-Aware**: Uses automation_id and company context for better responses

## Monitoring

### Health Check
```bash
curl http://localhost:8000/health
```

### Logs
```bash
# Docker
docker logs diligence_kit_liaison_agent

# Kubernetes
kubectl logs -n prod -l app=diligence-kit-liaison-agent -f
```

## Security

- API Key authentication on all endpoints (except /health)
- Service-to-service authentication via X-API-Key header
- GCP Workload Identity for secure credential management
- No sensitive data logged

## Resources

- **CPU Request**: 250m (limit: 1 core)
- **Memory Request**: 512Mi (limit: 2Gi)
- **Port**: 8000
- **Service Type**: ClusterIP (internal only)

## Support

For issues or questions, contact the Diligence Kit development team.