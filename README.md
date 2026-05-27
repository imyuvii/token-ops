# TokenOps

Production-grade observability for LLM applications.

## What is included

This repository now contains a functional full-stack MVP from the PRD:

- `apps/web`: a Next.js observability app with overview, requests, prompts, alerts, and ingest screens
  plus governance and live-operations views
- `apps/api`: a FastAPI service with persistent telemetry storage, seeded data, analytics endpoints, and alert rules
- `sdks/node` and `sdks/python`: simple ingestion clients for sending telemetry events

## Quick start

### API

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Web

```bash
cd apps/web
npm install
npm run build
npm run start
```

The dashboard expects the API at `http://localhost:8000` by default.

### Demo sign-in

The web app now redirects anonymous users to `/login`.
Use one of the seeded local demo identities such as:

- `avery@acme.ai` (`admin`)
- `maya@acme.ai` (`manager`)
- `nina@acme.ai` (`engineer`)
- `leo@acme.ai` (`viewer`)

### Docker Compose

```bash
docker compose up --build
```

This starts:

- API on `http://localhost:8000`
- Web app on `http://localhost:3000`

## Included surfaces

- Executive KPI overview
- Spend timeline and endpoint posture
- Latency heatmap
- Model comparison table
- Prompt and version analytics
- Recent request explorer
- Alert stream and alert rule manager
- Live operations stream and notification outbox
- Team usage leaderboard
- Cache savings summary
- Telemetry ingest playground

## API endpoints

- `GET /api/v1/dashboard`
- `GET /api/v1/events`
- `POST /api/v1/events`
- `GET /api/v1/prompts`
- `GET /api/v1/models`
- `GET /api/v1/alerts/rules`
- `POST /api/v1/alerts/rules`
- `PATCH /api/v1/alerts/rules/{id}?enabled=true|false`
- `GET /api/v1/alerts/incidents`
- `GET /api/v1/projects`
- `GET /api/v1/api-keys`
- `POST /api/v1/api-keys`
- `PATCH /api/v1/api-keys/{id}?is_active=true|false`
- `POST /api/v1/replay`
- `GET /api/v1/anomalies`
- `GET /api/v1/organization`
- `GET /api/v1/members`
- `GET /api/v1/export/events.csv`
- `GET /api/v1/benchmarks`
- `GET /api/v1/recommendations`
- `GET /api/v1/quality`
- `GET /api/v1/me`
- `GET /api/v1/notification-destinations`
- `POST /api/v1/notification-destinations`
- `PATCH /api/v1/notification-destinations/{id}?is_active=true|false`
- `POST /api/v1/notification-destinations/{id}/test`

`POST /api/v1/events` accepts an optional `x-tokenops-key` header for governed ingestion.

## Data model

Telemetry events are stored with:

- Team, application, environment, endpoint
- Provider and model
- Prompt name and version
- Redacted prompt text
- Tokens in, tokens out, total tokens
- Cost
- Latency, TTFT, stream duration
- Success or error state
- Cache hit and error type

## Added platform features

- Project budgets for AI workloads
- API key issuance and key status toggling
- Request replay for debugging and comparison
- Baseline anomaly insights for spend, latency, cache, and error rate
- Live event streaming and notification outbox
- Dockerized local stack and GitHub Actions CI
- Organization roles and CSV export support
- Optimization benchmarks and recommendations
- Local role-based sign-in and protected admin mutations
- Quality and hallucination-risk analytics
- Signal-level quality breakdowns and low-confidence review cases

## Next recommended milestones

1. Swap SQLite for PostgreSQL and add Redis-backed caching
2. Add authentication, organizations, and RBAC
3. Add realtime ingestion workers and websockets
4. Add external notification delivery for alerts
5. Add replay workflows, anomaly detection, and quality scoring
