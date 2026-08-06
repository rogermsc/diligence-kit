# Environment Variables Documentation

## Required Variables

These variables **must** be set for the application to start:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `GCLOUD_STORAGE_BUCKET` | Google Cloud Storage bucket name | `my-storage-bucket` |
| `AGENT_API_URL` | URL for the external agent API | `http://localhost:8000` |

## Optional Variables

These variables have default values and are optional:

### Server Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |

### Redis Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6381` | Redis server port |

### RabbitMQ Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ connection URL |

### JWT Authentication
| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | **required** | JWT signing secret. Startup fails if unset or shorter than 32 characters — there is no default. |
| `JWT_EXPIRES_IN` | `24h` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime. Must match the 7-day `expiresAt` written to `refresh_tokens` — a longer value yields a JWT that verifies after the row has expired, a shorter one leaves rows that can never be redeemed. |

### Email Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | - | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASS` | - | SMTP password |
| `SMTP_SECURE` | `false` | Use SSL/TLS |
| `EMAIL_SENDER` | - | Default sender email |
| `EMAIL_DESTINATION` | - | Default destination email |
| `RESEND_API_KEY` | - | Resend service API key |

### Stale-run reaper
| Variable | Default | Description |
|----------|---------|-------------|
| `AUTOMATION_TIMEOUT_MINUTES` | `60` | How long an automation may sit in `PROCESSING` before it is marked `FAILED`. Set it above the longest real run: the agent's callback is what normally ends the run, so anything still processing past this never received one. |
| `AUTOMATION_REAPER_INTERVAL_MINUTES` | `5` | How often to sweep. |
| `AUTOMATION_REAPER_ENABLED` | `true` | Set to `false` to disable. Interrupted runs then stay `PROCESSING` until someone updates them by hand. |

### Feature Flags
| Variable | Default | Description |
|----------|---------|-------------|
| `ONEPAGER_INCREMENTAL_ENABLED` | `false` | Enable OnePager incremental feature |

## Environment Validation

The application automatically validates all environment variables on startup using the `EnvValidator` class. If any required variables are missing, the application will:

1. Log detailed error messages
2. Exit with code 1
3. Display which variables are missing

### Validation Features

- ✅ **Required variables check**: Ensures all critical variables are set
- ✅ **Type validation**: Validates numeric ports, boolean flags, URLs
- ✅ **Default values**: Automatically applies defaults for optional variables
- ✅ **Detailed logging**: Shows which variables are set vs using defaults
- ✅ **Environment summary**: Displays configuration overview on startup

### Example Startup Output

```
🔍 Validating environment variables...
✅ DATABASE_URL: *** (set)
✅ GCLOUD_STORAGE_BUCKET: *** (set)  
✅ AGENT_API_URL: *** (set)
⚠️ REDIS_HOST: using default "localhost"
✅ JWT_SECRET: *** (set)
✅ ONEPAGER_INCREMENTAL_ENABLED: *** (set)
✅ All environment variables validated successfully

📋 Environment Variables Summary:
   🌍 NODE_ENV: development
   🚀 PORT: 3000
   📊 REDIS: localhost:6381
   🐰 RABBITMQ: default (localhost:5672)
   ☁️ GCLOUD_STORAGE_BUCKET: configured
   🤖 AGENT_API_URL: configured
   📄 ONEPAGER_INCREMENTAL: true
```

## Error Handling

If validation fails, you'll see errors like:

```
💥 Failed to start application due to environment validation errors:
❌ Missing required environment variables: DATABASE_URL, GCLOUD_STORAGE_BUCKET
```

## Usage in Code

The validator is automatically called in `main.ts` before the application starts. You can also use it manually:

```typescript
import { EnvValidator } from '@/shared/validators/env-validator'

// Validate and get config
const config = EnvValidator.validateEnvironmentVariables()

// Display summary
EnvValidator.getEnvSummary()
```
