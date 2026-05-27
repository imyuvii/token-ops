# TokenOps

Production-grade observability for LLM applications.

## What is included

This repository now contains a functional full-stack MVP from the PRD:

- `apps/web`: a Next.js observability app with overview, requests, prompts, alerts, and ingest screens
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

## Included surfaces

- Executive KPI overview
- Spend timeline and endpoint posture
- Latency heatmap
- Model comparison table
- Prompt and version analytics
- Recent request explorer
- Alert stream and alert rule manager
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

## Next recommended milestones

1. Swap SQLite for PostgreSQL and add Redis-backed caching
2. Add authentication, organizations, and RBAC
3. Add realtime ingestion workers and websockets
4. Add external notification delivery for alerts
5. Add replay workflows, anomaly detection, and quality scoring
