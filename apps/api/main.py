from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio
import json

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from database import get_connection, init_db
from schemas import (
    AlertRule,
    AlertRuleCreate,
    ApiKey,
    ApiKeyCreate,
    ApiKeyCreateResponse,
    DashboardResponse,
    NotificationDelivery,
    PromptInsight,
    Project,
    ReplayRequest,
    ReplayResult,
    TelemetryEvent,
    TelemetryEventCreate,
)
from services import (
    create_api_key,
    create_alert_rule,
    create_event,
    get_anomalies,
    get_dashboard_data,
    get_incidents,
    get_model_comparison,
    list_notification_deliveries,
    get_prompt_insights,
    get_recent_events,
    list_api_keys,
    list_projects,
    list_alert_rules,
    replay_request,
    update_alert_rule,
    set_api_key_status,
    validate_api_key,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="TokenOps API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/dashboard", response_model=DashboardResponse)
def get_dashboard(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> DashboardResponse:
    with get_connection() as connection:
        return get_dashboard_data(connection, days, team, model, environment, application)


@app.get("/api/v1/events", response_model=list[TelemetryEvent])
def list_events(
    limit: int = Query(40, ge=1, le=200),
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[TelemetryEvent]:
    with get_connection() as connection:
        return get_recent_events(connection, limit, days, team, model, environment, application)


@app.post("/api/v1/events", response_model=TelemetryEvent, status_code=201)
def ingest_event(
    payload: TelemetryEventCreate,
    x_tokenops_key: str | None = Header(default=None),
) -> TelemetryEvent:
    with get_connection() as connection:
        if x_tokenops_key:
            project = validate_api_key(connection, x_tokenops_key)
            if project is None:
                raise HTTPException(status_code=401, detail="Invalid TokenOps API key.")
        return create_event(connection, payload)


@app.get("/api/v1/prompts", response_model=list[PromptInsight])
def list_prompt_insights(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[PromptInsight]:
    with get_connection() as connection:
        return get_prompt_insights(connection, days, team, model, environment, application)


@app.get("/api/v1/models")
def list_models(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
):
    with get_connection() as connection:
        return get_model_comparison(connection, days, team, model, environment, application)


@app.get("/api/v1/alerts/rules", response_model=list[AlertRule])
def get_alert_rules() -> list[AlertRule]:
    with get_connection() as connection:
        return list_alert_rules(connection)


@app.post("/api/v1/alerts/rules", response_model=AlertRule, status_code=201)
def add_alert_rule(payload: AlertRuleCreate) -> AlertRule:
    with get_connection() as connection:
        return create_alert_rule(connection, payload)


@app.patch("/api/v1/alerts/rules/{rule_id}", response_model=AlertRule)
def toggle_alert_rule(rule_id: int, enabled: bool) -> AlertRule:
    with get_connection() as connection:
        return update_alert_rule(connection, rule_id, enabled)


@app.get("/api/v1/alerts/incidents")
def list_incidents(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
):
    with get_connection() as connection:
        return get_incidents(connection, days, team, model, environment, application)


@app.get("/api/v1/projects", response_model=list[Project])
def get_projects() -> list[Project]:
    with get_connection() as connection:
        return list_projects(connection)


@app.get("/api/v1/api-keys", response_model=list[ApiKey])
def get_api_keys() -> list[ApiKey]:
    with get_connection() as connection:
        return list_api_keys(connection)


@app.post("/api/v1/api-keys", response_model=ApiKeyCreateResponse, status_code=201)
def add_api_key(payload: ApiKeyCreate) -> ApiKeyCreateResponse:
    with get_connection() as connection:
        return create_api_key(connection, payload)


@app.patch("/api/v1/api-keys/{key_id}", response_model=ApiKey)
def toggle_api_key(key_id: int, is_active: bool) -> ApiKey:
    with get_connection() as connection:
        return set_api_key_status(connection, key_id, is_active)


@app.post("/api/v1/replay", response_model=ReplayResult)
def replay(payload: ReplayRequest) -> ReplayResult:
    with get_connection() as connection:
        try:
            return replay_request(connection, payload)
        except ValueError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/v1/anomalies")
def list_anomalies(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
):
    with get_connection() as connection:
        return get_anomalies(connection, days, team, model, environment, application)


@app.get("/api/v1/notifications", response_model=list[NotificationDelivery])
def get_notifications(limit: int = Query(25, ge=1, le=100)) -> list[NotificationDelivery]:
    with get_connection() as connection:
        return list_notification_deliveries(connection, limit)


@app.get("/api/v1/stream/events")
async def stream_events(limit: int = Query(10, ge=1, le=25)):
    async def event_generator():
        for _ in range(5):
            with get_connection() as connection:
                events = get_recent_events(connection, limit=limit, days=30)
            payload = json.dumps([event.model_dump() for event in events])
            yield f"data: {payload}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
