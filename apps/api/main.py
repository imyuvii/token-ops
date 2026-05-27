from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection, init_db
from schemas import AlertRule, AlertRuleCreate, DashboardResponse, PromptInsight, TelemetryEvent, TelemetryEventCreate
from services import (
    create_alert_rule,
    create_event,
    get_dashboard_data,
    get_incidents,
    get_model_comparison,
    get_prompt_insights,
    get_recent_events,
    list_alert_rules,
    update_alert_rule,
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
def ingest_event(payload: TelemetryEventCreate) -> TelemetryEvent:
    with get_connection() as connection:
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
