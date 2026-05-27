from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio
import json
from base64 import urlsafe_b64decode

from fastapi import Cookie, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from database import get_connection, init_db
from schemas import (
    AlertRule,
    AlertRuleCreate,
    ApiKey,
    ApiKeyCreate,
    ApiKeyCreateResponse,
    BenchmarkEntry,
    CurrentUser,
    DashboardResponse,
    Member,
    NotificationDelivery,
    NotificationDestination,
    NotificationDestinationCreate,
    Organization,
    PromptInsight,
    Project,
    QualityResponse,
    Recommendation,
    ReplayRequest,
    ReplayResult,
    TelemetryEvent,
    TelemetryEventCreate,
)
from services import (
    create_api_key,
    create_alert_rule,
    create_event,
    create_notification_destination,
    export_events_csv,
    get_anomalies,
    get_recommendations,
    get_team_benchmarks,
    get_dashboard_data,
    get_incidents,
    get_model_comparison,
    get_current_organization,
    list_notification_deliveries,
    list_notification_destinations,
    list_members,
    get_prompt_insights,
    get_quality_overview,
    get_recent_events,
    list_api_keys,
    list_projects,
    list_alert_rules,
    replay_request,
    update_alert_rule,
    set_api_key_status,
    test_notification_destination,
    toggle_notification_destination,
    validate_api_key,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="TokenOps API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(tokenops_session: str | None = Cookie(default=None)) -> CurrentUser:
    if not tokenops_session:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = json.loads(urlsafe_b64decode(f"{tokenops_session}==").decode("utf-8"))
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid session.") from error
    return CurrentUser(
        name=payload["name"],
        email=payload["email"],
        role=payload["role"],
        team=payload["team"],
    )


def require_roles(user: CurrentUser, allowed: set[str]) -> CurrentUser:
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return user


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/me", response_model=CurrentUser)
def get_me(tokenops_session: str | None = Cookie(default=None)) -> CurrentUser:
    return get_current_user(tokenops_session)


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
    require_roles(get_current_user(), {"admin", "manager"})
    with get_connection() as connection:
        return create_alert_rule(connection, payload)


@app.patch("/api/v1/alerts/rules/{rule_id}", response_model=AlertRule)
def toggle_alert_rule(rule_id: int, enabled: bool) -> AlertRule:
    require_roles(get_current_user(), {"admin", "manager"})
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
    require_roles(get_current_user(), {"admin", "manager"})
    with get_connection() as connection:
        return create_api_key(connection, payload)


@app.patch("/api/v1/api-keys/{key_id}", response_model=ApiKey)
def toggle_api_key(key_id: int, is_active: bool) -> ApiKey:
    require_roles(get_current_user(), {"admin", "manager"})
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


@app.get("/api/v1/organization", response_model=Organization)
def get_organization() -> Organization:
    with get_connection() as connection:
        return get_current_organization(connection)


@app.get("/api/v1/members", response_model=list[Member])
def get_members() -> list[Member]:
    with get_connection() as connection:
        return list_members(connection)


@app.get("/api/v1/export/events.csv")
def export_events(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
):
    with get_connection() as connection:
        payload = export_events_csv(connection, days, team, model, environment, application)
    return Response(
        content=payload,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tokenops-events.csv"},
    )


@app.get("/api/v1/benchmarks", response_model=list[BenchmarkEntry])
def list_benchmarks(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[BenchmarkEntry]:
    with get_connection() as connection:
        return get_team_benchmarks(connection, days, team, model, environment, application)


@app.get("/api/v1/recommendations", response_model=list[Recommendation])
def list_recommendations(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[Recommendation]:
    with get_connection() as connection:
        return get_recommendations(connection, days, team, model, environment, application)


@app.get("/api/v1/quality", response_model=QualityResponse)
def get_quality(
    days: int = Query(30, ge=1, le=90),
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> QualityResponse:
    with get_connection() as connection:
        return get_quality_overview(connection, days, team, model, environment, application)


@app.get("/api/v1/notification-destinations", response_model=list[NotificationDestination])
def get_notification_destinations() -> list[NotificationDestination]:
    with get_connection() as connection:
        return list_notification_destinations(connection)


@app.post("/api/v1/notification-destinations", response_model=NotificationDestination, status_code=201)
def add_notification_destination(payload: NotificationDestinationCreate) -> NotificationDestination:
    require_roles(get_current_user(), {"admin", "manager"})
    with get_connection() as connection:
        return create_notification_destination(connection, payload.name, payload.channel, payload.target)


@app.patch("/api/v1/notification-destinations/{destination_id}", response_model=NotificationDestination)
def set_notification_destination(destination_id: int, is_active: bool) -> NotificationDestination:
    require_roles(get_current_user(), {"admin", "manager"})
    with get_connection() as connection:
        return toggle_notification_destination(connection, destination_id, is_active)


@app.post("/api/v1/notification-destinations/{destination_id}/test", response_model=NotificationDelivery)
def send_test_notification(destination_id: int) -> NotificationDelivery:
    require_roles(get_current_user(), {"admin", "manager"})
    with get_connection() as connection:
        try:
            return test_notification_destination(connection, destination_id)
        except ValueError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
