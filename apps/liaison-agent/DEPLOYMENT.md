# Diligence Kit Liaison Agent - Deployment Guide

## Deployment Configuration Created

The following Kubernetes deployment files have been created following the same pattern as other Diligence Kit agents:

### Files Created

```
diligence-kit-liaison-agent/
├── k8s/prod/
│   ├── deployment.yaml       # Main deployment configuration
│   ├── service.yaml          # ClusterIP service (port 8000)
│   ├── service-account.yaml  # GCP Workload Identity binding
│   └── secrets.yaml          # External Secrets configuration
├── vars/prod.yml             # Production variables
├── .dockerignore             # Docker build exclusions
└── README.md                 # Updated with deployment instructions
```

## Deployment Architecture

### Container Specifications

- **Image**: `us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:latest`
- **Port**: 8000
- **Service Type**: ClusterIP (internal only)
- **Namespace**: prod
- **Replicas**: 1

### Resource Allocation

```yaml
requests:
  cpu: 250m
  memory: 512Mi
limits:
  cpu: 1
  memory: 2Gi
```

### Health Checks

**Liveness Probe:**
- Path: `/health`
- Initial Delay: 60s
- Period: 30s
- Timeout: 10s
- Failure Threshold: 5

**Readiness Probe:**
- Path: `/health`
- Initial Delay: 30s
- Period: 15s
- Timeout: 5s
- Failure Threshold: 3

## Required Secrets in Google Secret Manager

Before deploying, create the following secrets in Google Secret Manager:

### GCP Secrets
```bash
diligence-kit-liaison-gcp-project-id-prod      # your-gcp-project-id
diligence-kit-liaison-gcp-location-prod        # us-central1
```

### Database Secrets
```bash
diligence-kit-liaison-database-url-prod        # postgresql+asyncpg://user:pass@host:5432/db
```

### Application Secrets
```bash
diligence-kit-liaison-api-key-prod             # API key for service authentication
diligence-kit-liaison-env-prod                 # prod
diligence-kit-liaison-log-level-prod           # INFO
```

## Deployment Steps

### 1. Build and Push Docker Image

```bash
cd diligence-kit-liaison-agent

# Build the image
docker build -t us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:latest .

# Authenticate with GCP
gcloud auth configure-docker us-central1-docker.pkg.dev

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:latest
```

### 2. Create Secrets in Google Secret Manager

```bash
# GCP Project ID
echo -n "your-gcp-project-id" | gcloud secrets create diligence-kit-liaison-gcp-project-id-prod --data-file=-

# GCP Location
echo -n "us-central1" | gcloud secrets create diligence-kit-liaison-gcp-location-prod --data-file=-

# Database URL (replace with actual connection string)
echo -n "postgresql+asyncpg://user:password@postgres-host:5432/diligence_kit_liaison" | gcloud secrets create diligence-kit-liaison-database-url-prod --data-file=-

# API Key (generate a secure random key)
openssl rand -base64 32 | gcloud secrets create diligence-kit-liaison-api-key-prod --data-file=-

# Environment
echo -n "prod" | gcloud secrets create diligence-kit-liaison-env-prod --data-file=-

# Log Level
echo -n "INFO" | gcloud secrets create diligence-kit-liaison-log-level-prod --data-file=-
```

### 3. Grant Secret Access to Service Account

```bash
# Get the project number
PROJECT_NUMBER=$(gcloud projects describe your-gcp-project-id --format="value(projectNumber)")

# Grant access to all liaison secrets
for secret in \
  diligence-kit-liaison-gcp-project-id-prod \
  diligence-kit-liaison-gcp-location-prod \
  diligence-kit-liaison-database-url-prod \
  diligence-kit-liaison-api-key-prod \
  diligence-kit-liaison-env-prod \
  diligence-kit-liaison-log-level-prod
do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:diligence-kit@your-gcp-project-id.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 4. Deploy to Kubernetes

```bash
# Apply in order
kubectl apply -f k8s/prod/service-account.yaml
kubectl apply -f k8s/prod/secrets.yaml

# Wait for External Secrets to sync (check status)
kubectl get externalsecrets -n prod

# Deploy service and application
kubectl apply -f k8s/prod/service.yaml
kubectl apply -f k8s/prod/deployment.yaml
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -n prod -l app=diligence-kit-liaison-agent

# Check logs
kubectl logs -n prod -l app=diligence-kit-liaison-agent -f

# Check service
kubectl get svc -n prod diligence-kit-liaison-agent

# Test health endpoint from another pod
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n prod -- \
  curl http://diligence-kit-liaison-agent:8000/health
```

## Database Setup

The liaison agent requires a PostgreSQL database. Ensure migrations are run:

```bash
# From within the pod or using a job
kubectl exec -it -n prod <pod-name> -- alembic upgrade head
```

Or create a Kubernetes Job:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: liaison-agent-migration
  namespace: prod
spec:
  template:
    spec:
      serviceAccountName: diligence-kit-liaison-agent
      containers:
      - name: migration
        image: us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:latest
        command: ["alembic", "upgrade", "head"]
        env:
          - name: DATABASE_URL
            valueFrom:
              secretKeyRef:
                name: diligence-kit-liaison-database-secret
                key: database-url
      restartPolicy: Never
  backoffLimit: 3
```

## Service Discovery

The liaison agent is accessible within the cluster at:

```
http://diligence-kit-liaison-agent.prod.svc.cluster.local:8000
```

Or simply:

```
http://diligence-kit-liaison-agent:8000
```

## Integration with Other Services

### From diligence-kit-service (NestJS)

Add environment variable:
```bash
LIAISON_AGENT_URL=http://diligence-kit-liaison-agent:8000
LIAISON_API_KEY=<api-key-from-secret>
```

### From diligence-kit-web (Next.js)

The web frontend should call through the backend API, not directly to the liaison agent.

## Monitoring

### Logs
```bash
# Follow logs
kubectl logs -n prod -l app=diligence-kit-liaison-agent -f

# View recent logs
kubectl logs -n prod -l app=diligence-kit-liaison-agent --tail=100
```

### Metrics
```bash
# Pod status
kubectl get pods -n prod -l app=diligence-kit-liaison-agent

# Resource usage
kubectl top pod -n prod -l app=diligence-kit-liaison-agent
```

### Health Check
```bash
# From within cluster
curl http://diligence-kit-liaison-agent:8000/health
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod events
kubectl describe pod -n prod -l app=diligence-kit-liaison-agent

# Check secret sync
kubectl get externalsecrets -n prod
kubectl describe externalsecret diligence-kit-liaison-app-secret -n prod
```

### Database Connection Issues

```bash
# Verify DATABASE_URL secret
kubectl get secret diligence-kit-liaison-database-secret -n prod -o yaml

# Test connection from pod
kubectl exec -it -n prod <pod-name> -- python -c "
from sqlalchemy import create_engine
import os
engine = create_engine(os.getenv('DATABASE_URL'))
conn = engine.connect()
print('Connection successful!')
"
```

### API Key Issues

```bash
# Verify API key is set
kubectl exec -it -n prod <pod-name> -- env | grep API_KEY

# Test endpoint
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n prod -- \
  curl -H "X-API-Key: <your-key>" http://diligence-kit-liaison-agent:8000/health
```

## Rollback

```bash
# View deployment history
kubectl rollout history deployment/diligence-kit-liaison-agent -n prod

# Rollback to previous version
kubectl rollout undo deployment/diligence-kit-liaison-agent -n prod

# Rollback to specific revision
kubectl rollout undo deployment/diligence-kit-liaison-agent -n prod --to-revision=2
```

## Scaling

```bash
# Scale replicas
kubectl scale deployment diligence-kit-liaison-agent -n prod --replicas=2

# Or edit deployment
kubectl edit deployment diligence-kit-liaison-agent -n prod
```

## Updates

To deploy a new version:

```bash
# Build and push new image
docker build -t us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:v1.1.0 .
docker push us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:v1.1.0

# Update deployment
kubectl set image deployment/diligence-kit-liaison-agent \
  diligence-kit-liaison-agent=us-central1-docker.pkg.dev/your-gcp-project-id/diligence-kit-artifacts/diligence-kit-liaison-agent-prod:v1.1.0 \
  -n prod

# Watch rollout
kubectl rollout status deployment/diligence-kit-liaison-agent -n prod
```

## Comparison with Other Agents

| Feature | Triage Agent | Diligence Agent | Liaison Agent |
|---------|-------------|-----------------|---------------|
| Port | 8000 | 8002 | 8000 |
| Service Type | NodePort | ClusterIP | ClusterIP |
| CPU Request | 500m | 500m | 250m |
| Memory Request | 1Gi | 1Gi | 512Mi |
| Sidecar Containers | Qdrant, Redis | None | None |
| External Access | Yes (Qdrant) | No | No |

The liaison agent is lighter weight as it doesn't require vector database or message queue sidecars.
