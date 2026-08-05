# Diligence Kit Liaison Agent - API Contract

## Base URL

```
Production: http://diligence-kit-liaison-agent:8000
Local Dev:  http://localhost:8000
```

## Authentication

All endpoints (except `/health`) require API Key authentication via header:

```
X-API-Key: <your-api-key>
```

## Endpoints

### 1. Chat Endpoint

Process user messages and get AI-generated responses.

**Endpoint:** `POST /chat`

**Headers:**
```
X-API-Key: string (required)
Content-Type: application/json
```

**Request Body:**
```typescript
{
  message: string;                    // Required - User message
  session_id?: string;                // Optional - Session ID for context
  user_id?: string;                   // Optional - User identifier
  automation_id?: string;             // Optional - Automation UUID for technical support
  company_context?: {                 // Optional - Additional context
    name?: string;
    sector?: string;
    [key: string]: any;
  }
}
```

**Response (200 OK):**
```typescript
{
  response: string;                   // AI-generated response
  session_id: string;                 // Session ID (returned or created)
}
```

**Error Responses:**
```typescript
// 401 Unauthorized
{
  detail: "Missing API Key" | "Invalid API Key"
}

// 500 Internal Server Error
{
  detail: "An unexpected error occurred processing your request."
}
```

**Example:**
```bash
curl -X POST http://diligence-kit-liaison-agent:8000/chat \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I upload documents?",
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user123",
    "automation_id": "650e8400-e29b-41d4-a716-446655440001"
  }'
```

---

### 2. Get or Create Session

Retrieve the last active session for a user or create a new one.

**Endpoint:** `GET /session/last`

**Headers:**
```
X-API-Key: string (required)
```

**Query Parameters:**
```
user_id: string (required)
```

**Response (200 OK):**
```typescript
{
  session_id: string;                 // Existing or new session ID
}
```

**Example:**
```bash
curl -X GET "http://diligence-kit-liaison-agent:8000/session/last?user_id=user123" \
  -H "X-API-Key: your-api-key"
```

---

### 3. Create New Session

Force creation of a new session ID.

**Endpoint:** `POST /session/create`

**Headers:**
```
X-API-Key: string (required)
Content-Type: application/json
```

**Request Body:**
```typescript
{
  user_id: string;                    // Required - User identifier
}
```

**Response (200 OK):**
```typescript
{
  session_id: string;                 // New session ID
}
```

**Example:**
```bash
curl -X POST http://diligence-kit-liaison-agent:8000/session/create \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123"}'
```

---

### 4. Health Check

Check service health status.

**Endpoint:** `GET /health`

**Authentication:** None required

**Response (200 OK):**
```typescript
{
  status: "healthy"
}
```

**Example:**
```bash
curl http://diligence-kit-liaison-agent:8000/health
```

---

## Integration Examples

### TypeScript/Next.js (Frontend via API Route)

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const response = await fetch('http://diligence-kit-liaison-agent:8000/chat', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.LIAISON_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: body.message,
      session_id: body.sessionId,
      user_id: body.userId,
      automation_id: body.automationId,
      company_context: body.companyContext,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Failed to get response from liaison agent' },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
```

### NestJS (Backend Service)

```typescript
// liaison-agent.service.ts
import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LiaisonAgentService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('LIAISON_AGENT_URL');
    this.apiKey = this.configService.get('LIAISON_API_KEY');
  }

  async chat(params: {
    message: string;
    sessionId?: string;
    userId?: string;
    automationId?: string;
    companyContext?: Record<string, any>;
  }) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/chat`,
        {
          message: params.message,
          session_id: params.sessionId,
          user_id: params.userId,
          automation_id: params.automationId,
          company_context: params.companyContext,
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return response.data;
  }

  async getOrCreateSession(userId: string) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/session/last`, {
        params: { user_id: userId },
        headers: { 'X-API-Key': this.apiKey },
      }),
    );

    return response.data;
  }
}
```

### Python (FastAPI Service)

```python
# liaison_client.py
import httpx
from typing import Optional, Dict, Any

class LiaisonAgentClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    async def chat(
        self,
        message: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        automation_id: Optional[str] = None,
        company_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat",
                headers=self.headers,
                json={
                    "message": message,
                    "session_id": session_id,
                    "user_id": user_id,
                    "automation_id": automation_id,
                    "company_context": company_context
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_or_create_session(self, user_id: str) -> Dict[str, str]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/session/last",
                headers={"X-API-Key": self.api_key},
                params={"user_id": user_id}
            )
            response.raise_for_status()
            return response.json()

# Usage
client = LiaisonAgentClient(
    base_url="http://diligence-kit-liaison-agent:8000",
    api_key=os.getenv("LIAISON_API_KEY")
)

result = await client.chat(
    message="How do I upload documents?",
    user_id="user123",
    automation_id="650e8400-e29b-41d4-a716-446655440001"
)
print(result["response"])
```

---

## Agent Behavior

### Intent Classification

The router node classifies messages into three categories:

1. **ERROR_REPORT**: User reports technical issues
   - Triggers Ombudsman Node
   - Retrieves logs from Google Cloud Logging
   - Analyzes logs with AI
   - Provides diagnostic information

2. **HOW_TO**: User asks usage questions
   - Triggers Support Node
   - Uses RAG with SYSTEM_USER_GUIDE.md
   - Provides documentation-based answers

3. **CHITCHAT**: General conversation
   - Skips to Response Node
   - Provides conversational responses

### Context Usage

- **automation_id**: Required for ERROR_REPORT to retrieve specific logs
- **company_context**: Enriches responses with company-specific information
- **session_id**: Maintains conversation history (last 30 messages)
- **user_id**: Links sessions to users

### Response Characteristics

- Always responds in **English** regardless of input language
- Professional Level 2 support tone
- Translates technical information into accessible language
- Provides actionable next steps when appropriate

---

## Session Management

### Session Lifecycle

1. **First Message**: If no `session_id` provided, agent creates new session
2. **Subsequent Messages**: Include `session_id` to maintain context
3. **New Conversation**: Call `/session/create` to start fresh

### Best Practices

- Store `session_id` in frontend state/localStorage
- Include `session_id` in all chat requests for context
- Create new session when switching companies/automations
- Pass `automation_id` when chatting from automation detail pages

---

## Error Handling

### Common Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 401 | Missing API Key | No X-API-Key header | Add authentication header |
| 401 | Invalid API Key | Wrong API key | Verify API key value |
| 500 | Internal Server Error | Service error | Check logs, retry request |

### Retry Strategy

```typescript
async function chatWithRetry(message: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing at the API gateway level if needed.

---

## Monitoring

### Health Check Polling

```typescript
async function checkHealth() {
  try {
    const response = await fetch('http://diligence-kit-liaison-agent:8000/health');
    return response.ok;
  } catch {
    return false;
  }
}

// Poll every 30 seconds
setInterval(checkHealth, 30000);
```

### Logging Recommendations

Log the following for debugging:
- Request message and session_id
- Response time
- Error responses
- automation_id when provided

---

## Security Considerations

1. **Never expose API key to frontend**: Always proxy through backend
2. **Validate user_id**: Ensure authenticated user matches user_id
3. **Sanitize inputs**: Validate message length and content
4. **Rate limit**: Implement rate limiting at API gateway
5. **Audit logs**: Log all chat interactions for compliance

---

## Performance

### Expected Response Times

- Simple chat: 1-3 seconds
- With log analysis: 3-7 seconds
- With RAG lookup: 2-5 seconds

### Optimization Tips

- Reuse session_id to leverage conversation cache
- Provide automation_id only when needed (technical support)
- Keep company_context minimal
- Implement request timeout (10s recommended)

---

## Support

For API issues or questions:
- Check service logs: `kubectl logs -n prod -l app=diligence-kit-liaison-agent`
- Verify health: `curl http://diligence-kit-liaison-agent:8000/health`
- Contact Diligence Kit development team
