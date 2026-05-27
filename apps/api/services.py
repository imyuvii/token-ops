from __future__ import annotations

import math
import re
import sqlite3
from io import StringIO
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any
from uuid import uuid4
import csv
from urllib import request as urlrequest
from urllib.error import URLError

from schemas import (
    AnomalyInsight,
    ApiKey,
    ApiKeyCreate,
    ApiKeyCreateResponse,
    BenchmarkEntry,
    AlertIncident,
    AlertRule,
    AlertRuleCreate,
    CacheSummary,
    DashboardResponse,
    FilterOptions,
    LatencyCell,
    MetricCard,
    ModelComparison,
    NotificationDelivery,
    Organization,
    PromptInsight,
    Member,
    NotificationDestination,
    Project,
    QualityMetric,
    QualityPromptRisk,
    QualityResponse,
    ReplayRequest,
    ReplayResult,
    Recommendation,
    RequestOverview,
    SpendPoint,
    TeamUsage,
    TelemetryEvent,
    TelemetryEventCreate,
)

MODELS = ["gpt-4.1", "gpt-4.1-mini", "claude-sonnet", "gemini-flash"]


def _format_int(value: float) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}k"
    return str(int(value))


def _format_currency(value: float) -> str:
    return f"${value:,.2f}"


def _format_compact_currency(value: float) -> str:
    if value >= 1_000:
        return f"${value / 1_000:.1f}k"
    return f"${value:.2f}"


def _parse_compact_currency(value: str) -> float:
    normalized = value.replace("$", "")
    if normalized.endswith("k"):
        return float(normalized[:-1]) * 1000
    return float(normalized)


def _percentile(values: list[int], percentile: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = math.ceil((percentile / 100) * len(ordered)) - 1
    return ordered[max(index, 0)]


def redact_prompt(text: str) -> str:
    text = re.sub(r"[\w\.-]+@[\w\.-]+\.\w+", "[REDACTED_EMAIL]", text)
    text = re.sub(r"\b\d{6,}\b", "[REDACTED_NUMBER]", text)
    return text


def _build_where(
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> tuple[str, list[Any]]:
    start_time = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    clauses = ["timestamp >= ?"]
    params: list[Any] = [start_time]

    if team:
      clauses.append("team = ?")
      params.append(team)
    if model:
      clauses.append("model = ?")
      params.append(model)
    if environment:
      clauses.append("environment = ?")
      params.append(environment)
    if application:
      clauses.append("application = ?")
      params.append(application)

    return " WHERE " + " AND ".join(clauses), params


def _query_events(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> list[sqlite3.Row]:
    where_clause, params = _build_where(days, team, model, environment, application)
    return connection.execute(
        f"SELECT * FROM telemetry_events {where_clause} ORDER BY timestamp DESC",
        params,
    ).fetchall()


def _get_filter_options(connection: sqlite3.Connection) -> FilterOptions:
    def distinct_values(column: str) -> list[str]:
        rows = connection.execute(
            f"SELECT DISTINCT {column} AS value FROM telemetry_events ORDER BY value ASC"
        ).fetchall()
        return [row["value"] for row in rows]

    return FilterOptions(
        teams=distinct_values("team"),
        models=distinct_values("model"),
        environments=distinct_values("environment"),
        applications=distinct_values("application"),
    )


def get_dashboard_data(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> DashboardResponse:
    rows = _query_events(connection, days, team, model, environment, application)
    previous_rows = _query_events(connection, days * 2, team, model, environment, application)
    current_cutoff = datetime.now(UTC) - timedelta(days=days)

    current_rows = [row for row in previous_rows if datetime.fromisoformat(row["timestamp"]) >= current_cutoff]
    prior_rows = [row for row in previous_rows if datetime.fromisoformat(row["timestamp"]) < current_cutoff]

    total_tokens = sum(row["total_tokens"] for row in rows)
    total_spend = sum(row["cost"] for row in rows)
    p95_latency = _percentile([row["latency_ms"] for row in rows], 95)
    cache_hits = sum(row["cache_hit"] for row in rows)
    cache_hit_rate = (cache_hits / len(rows) * 100) if rows else 0.0
    tokens_saved = sum(int(row["total_tokens"] * 0.35) for row in rows if row["cache_hit"])
    cost_saved = sum(row["cost"] * 0.28 for row in rows if row["cache_hit"])
    latency_saved = [
        row["latency_ms"] * 0.18 for row in rows if row["cache_hit"]
    ]
    latency_reduction = int(sum(latency_saved) / len(latency_saved)) if latency_saved else 0

    previous_spend = sum(row["cost"] for row in prior_rows) or 1
    spend_delta = ((total_spend - previous_spend) / previous_spend) * 100
    previous_tokens = sum(row["total_tokens"] for row in prior_rows) or 1
    tokens_delta = ((total_tokens - previous_tokens) / previous_tokens) * 100
    prior_p95 = _percentile([row["latency_ms"] for row in prior_rows], 95) or p95_latency
    latency_delta_ms = p95_latency - prior_p95
    prior_cache_rate = (sum(row["cache_hit"] for row in prior_rows) / len(prior_rows) * 100) if prior_rows else cache_hit_rate
    cache_delta = cache_hit_rate - prior_cache_rate

    metrics = [
        MetricCard(
            label="Total tokens",
            value=_format_int(total_tokens),
            delta=f"{tokens_delta:+.1f}%",
            trend=f"vs prior {days} days",
            accent="amber",
        ),
        MetricCard(
            label="AI spend",
            value=_format_currency(total_spend),
            delta=f"{spend_delta:+.1f}%",
            trend="cost movement",
            accent="cyan",
        ),
        MetricCard(
            label="P95 latency",
            value=f"{p95_latency / 1000:.1f}s",
            delta=f"{latency_delta_ms:+d}ms",
            trend="vs prior window",
            accent="coral",
        ),
        MetricCard(
            label="Cache savings",
            value=_format_currency(cost_saved),
            delta=f"{cache_delta:+.1f} pts",
            trend="cache hit change",
            accent="lime",
        ),
    ]

    spend_rows = connection.execute(
        f"""
        SELECT substr(timestamp, 1, 10) AS day, ROUND(SUM(cost), 2) AS spend, COUNT(*) AS requests
        FROM telemetry_events
        {_build_where(days, team, model, environment, application)[0]}
        GROUP BY substr(timestamp, 1, 10)
        ORDER BY day ASC
        """,
        _build_where(days, team, model, environment, application)[1],
    ).fetchall()
    spend_series = [
        SpendPoint(day=row["day"], spend=row["spend"], requests=row["requests"]) for row in spend_rows
    ]

    latency_heatmap = _build_latency_heatmap(rows)
    model_comparison = _build_model_comparison(rows)
    prompt_insights = _build_prompt_insights(rows)
    alerts = get_incidents(connection, days, team, model, environment, application)
    team_usage = _build_team_usage(rows)
    request_overview = _build_request_overview(rows)

    cache_summary = CacheSummary(
        hit_rate=f"{cache_hit_rate:.1f}%",
        tokens_saved=_format_int(tokens_saved),
        cost_saved=_format_currency(cost_saved),
        latency_reduction=f"{latency_reduction}ms",
    )

    return DashboardResponse(
        metrics=metrics,
        spend_series=spend_series,
        latency_heatmap=latency_heatmap,
        model_comparison=model_comparison,
        prompt_insights=prompt_insights[:5],
        alerts=alerts,
        team_usage=team_usage,
        cache_summary=cache_summary,
        request_overview=request_overview,
        filters=_get_filter_options(connection),
    )


def _build_latency_heatmap(rows: list[sqlite3.Row]) -> list[LatencyCell]:
    buckets: dict[str, dict[str, list[int]]] = {
        label: {model: [] for model in MODELS}
        for label in ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"]
    }
    for row in rows:
        timestamp = datetime.fromisoformat(row["timestamp"])
        bucket = f"{timestamp.hour - (timestamp.hour % 4):02d}:00"
        if row["model"] in buckets[bucket]:
            buckets[bucket][row["model"]].append(row["latency_ms"])

    cells: list[LatencyCell] = []
    for bucket, values in buckets.items():
        cells.append(
            LatencyCell(
                hour=bucket,
                **{
                    model: int(sum(model_values) / len(model_values)) if model_values else 0
                    for model, model_values in values.items()
                },
            )
        )
    return cells


def _build_model_comparison(rows: list[sqlite3.Row]) -> list[ModelComparison]:
    grouped: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        grouped.setdefault(row["model"], []).append(row)

    comparisons: list[ModelComparison] = []
    for model_name, model_rows in grouped.items():
        total = len(model_rows)
        success = sum(1 for row in model_rows if row["status"] == "success")
        retries = total - success
        avg_cost = sum(row["cost"] for row in model_rows) / total
        avg_latency = int(sum(row["latency_ms"] for row in model_rows) / total)
        cache_rate = sum(row["cache_hit"] for row in model_rows) / total * 100
        error_rate = retries / total * 100
        provider = model_rows[0]["provider"]
        quality_score = max(72, min(97, int(96 - error_rate - (avg_latency / 500))))
        comparisons.append(
            ModelComparison(
                model=model_name,
                provider=provider,
                avg_cost=_format_compact_currency(avg_cost),
                avg_latency=f"{avg_latency / 1000:.1f}s",
                reliability=f"{(success / total) * 100:.1f}%",
                quality_score=quality_score,
                cache_hit_rate=f"{cache_rate:.0f}%",
                retry_rate=f"{error_rate:.1f}%",
            )
        )
    return sorted(comparisons, key=lambda item: item.quality_score, reverse=True)


def _build_prompt_insights(rows: list[sqlite3.Row]) -> list[PromptInsight]:
    grouped: dict[tuple[str, str, str], list[sqlite3.Row]] = {}
    for row in rows:
        key = (row["prompt_name"], row["prompt_version"], row["team"])
        grouped.setdefault(key, []).append(row)

    insights: list[PromptInsight] = []
    for (name, version, owner), prompt_rows in grouped.items():
        total = len(prompt_rows)
        success_rate = sum(1 for row in prompt_rows if row["status"] == "success") / total * 100
        avg_cost = sum(row["cost"] for row in prompt_rows) / total
        avg_latency = int(sum(row["latency_ms"] for row in prompt_rows) / total)
        if success_rate >= 95 and avg_latency < 1800:
            status = "Optimized"
        elif success_rate >= 90:
            status = "Stable"
        else:
            status = "Needs review"
        insights.append(
            PromptInsight(
                name=name,
                version=version,
                owner=owner,
                success_rate=f"{success_rate:.1f}%",
                avg_cost=_format_compact_currency(avg_cost),
                avg_latency=f"{avg_latency / 1000:.1f}s",
                status=status,
                requests=total,
            )
        )
    return sorted(insights, key=lambda item: item.requests, reverse=True)


def _build_team_usage(rows: list[sqlite3.Row]) -> list[TeamUsage]:
    grouped: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        grouped.setdefault(row["team"], []).append(row)

    usage: list[TeamUsage] = []
    for team, team_rows in grouped.items():
        total = len(team_rows)
        spend = sum(row["cost"] for row in team_rows)
        tokens = sum(row["total_tokens"] for row in team_rows)
        error_rate = (sum(1 for row in team_rows if row["status"] != "success") / total) * 100
        cache_rate = (sum(row["cache_hit"] for row in team_rows) / total) * 100
        efficiency_score = max(72, min(98, int(100 - error_rate * 2 + cache_rate * 0.25)))
        usage.append(
            TeamUsage(
                team=team,
                spend=_format_currency(spend),
                tokens=_format_int(tokens),
                requests=_format_int(total),
                efficiency=f"{efficiency_score}/100",
            )
        )
    return sorted(usage, key=lambda item: float(item.spend.replace("$", "").replace(",", "")), reverse=True)


def _build_request_overview(rows: list[sqlite3.Row]) -> list[RequestOverview]:
    grouped: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        grouped.setdefault(row["endpoint"], []).append(row)

    overview: list[RequestOverview] = []
    for endpoint, endpoint_rows in grouped.items():
        latencies = [row["latency_ms"] for row in endpoint_rows]
        error_rate = sum(1 for row in endpoint_rows if row["status"] != "success") / len(endpoint_rows) * 100
        overview.append(
            RequestOverview(
                endpoint=endpoint,
                requests=len(endpoint_rows),
                error_rate=f"{error_rate:.1f}%",
                p95_latency=f"{_percentile(latencies, 95)}ms",
            )
        )
    return sorted(overview, key=lambda item: item.requests, reverse=True)[:6]


def get_recent_events(
    connection: sqlite3.Connection,
    limit: int = 40,
    days: int = 30,
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[TelemetryEvent]:
    rows = _query_events(connection, days, team, model, environment, application)[:limit]
    return [_row_to_event(row) for row in rows]


def get_prompt_insights(
    connection: sqlite3.Connection,
    days: int = 30,
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[PromptInsight]:
    rows = _query_events(connection, days, team, model, environment, application)
    return _build_prompt_insights(rows)


def get_model_comparison(
    connection: sqlite3.Connection,
    days: int = 30,
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[ModelComparison]:
    rows = _query_events(connection, days, team, model, environment, application)
    return _build_model_comparison(rows)


def get_incidents(
    connection: sqlite3.Connection,
    days: int = 30,
    team: str | None = None,
    model: str | None = None,
    environment: str | None = None,
    application: str | None = None,
) -> list[AlertIncident]:
    rows = _query_events(connection, days, team, model, environment, application)
    rules = list_alert_rules(connection)
    incidents: list[AlertIncident] = []
    if not rows:
        return incidents

    latest_timestamp = datetime.fromisoformat(rows[0]["timestamp"]).strftime("%Y-%m-%d %H:%M UTC")

    for rule in rules:
        if not rule.enabled:
            continue

        rule_rows = [
            row
            for row in rows
            if datetime.fromisoformat(row["timestamp"])
            >= datetime.now(UTC) - timedelta(minutes=rule.window_minutes)
        ]
        if not rule_rows:
            continue

        if rule.rule_type == "budget":
            spend = sum(row["cost"] for row in rule_rows)
            if spend > rule.threshold:
                incidents.append(
                    AlertIncident(
                        title=rule.name,
                        severity=rule.severity.title(),
                        context=f"Spend reached {_format_currency(spend)} in the last {rule.window_minutes // 60}h.",
                        timestamp=latest_timestamp,
                        status="Triggered",
                    )
                )
        elif rule.rule_type == "latency":
            latency = _percentile([row["latency_ms"] for row in rule_rows], 95)
            if latency > rule.threshold:
                incidents.append(
                    AlertIncident(
                        title=rule.name,
                        severity=rule.severity.title(),
                        context=f"P95 latency is {latency}ms against a {int(rule.threshold)}ms threshold.",
                        timestamp=latest_timestamp,
                        status="Triggered",
                    )
                )
        elif rule.rule_type == "error_rate":
            error_rate = sum(1 for row in rule_rows if row["status"] != "success") / len(rule_rows) * 100
            if error_rate > rule.threshold:
                incidents.append(
                    AlertIncident(
                        title=rule.name,
                        severity=rule.severity.title(),
                        context=f"Error rate is {error_rate:.1f}% over the last {rule.window_minutes} minutes.",
                        timestamp=latest_timestamp,
                        status="Triggered",
                    )
                )
        elif rule.rule_type == "cache_hit":
            cache_rate = sum(row["cache_hit"] for row in rule_rows) / len(rule_rows) * 100
            if cache_rate < rule.threshold:
                incidents.append(
                    AlertIncident(
                        title=rule.name,
                        severity=rule.severity.title(),
                        context=f"Cache hit rate fell to {cache_rate:.1f}% against a {rule.threshold:.0f}% floor.",
                        timestamp=latest_timestamp,
                        status="Triggered",
                    )
                )

    return incidents[:6]


def list_notification_deliveries(connection: sqlite3.Connection, limit: int = 25) -> list[NotificationDelivery]:
    rows = connection.execute(
        """
        SELECT * FROM notification_deliveries
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        NotificationDelivery(
            id=row["id"],
            rule_name=row["rule_name"],
            channel=row["channel"],
            severity=row["severity"],
            status=row["status"],
            context=row["context"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


def list_notification_destinations(connection: sqlite3.Connection) -> list[NotificationDestination]:
    rows = connection.execute(
        "SELECT * FROM notification_destinations ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [
        NotificationDestination(
            id=row["id"],
            name=row["name"],
            channel=row["channel"],
            target=row["target"],
            is_active=bool(row["is_active"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


def create_notification_destination(
    connection: sqlite3.Connection,
    name: str,
    channel: str,
    target: str,
) -> NotificationDestination:
    created_at = datetime.now(UTC).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO notification_destinations (name, channel, target, is_active, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (name, channel, target, 1, created_at),
    )
    connection.commit()
    return NotificationDestination(
        id=cursor.lastrowid,
        name=name,
        channel=channel,
        target=target,
        is_active=True,
        created_at=created_at,
    )


def toggle_notification_destination(
    connection: sqlite3.Connection,
    destination_id: int,
    is_active: bool,
) -> NotificationDestination:
    connection.execute(
        "UPDATE notification_destinations SET is_active = ? WHERE id = ?",
        (int(is_active), destination_id),
    )
    connection.commit()
    row = connection.execute(
        "SELECT * FROM notification_destinations WHERE id = ?",
        (destination_id,),
    ).fetchone()
    return NotificationDestination(
        id=row["id"],
        name=row["name"],
        channel=row["channel"],
        target=row["target"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


def get_current_organization(connection: sqlite3.Connection) -> Organization:
    row = connection.execute("SELECT * FROM organizations ORDER BY id ASC LIMIT 1").fetchone()
    return Organization(
        id=row["id"],
        name=row["name"],
        plan=row["plan"],
        created_at=row["created_at"],
    )


def list_members(connection: sqlite3.Connection) -> list[Member]:
    rows = connection.execute(
        "SELECT * FROM members ORDER BY role ASC, name ASC"
    ).fetchall()
    return [
        Member(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            role=row["role"],
            team=row["team"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


def record_notification_delivery(
    connection: sqlite3.Connection,
    rule_name: str,
    channel: str,
    severity: str,
    context: str,
    status: str = "delivered",
) -> NotificationDelivery:
    created_at = datetime.now(UTC).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO notification_deliveries (
            rule_name, channel, severity, status, context, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (rule_name, channel, severity, status, context, created_at),
    )
    connection.commit()
    return NotificationDelivery(
        id=cursor.lastrowid,
        rule_name=rule_name,
        channel=channel,
        severity=severity,
        status=status,
        context=context,
        created_at=created_at,
    )


def test_notification_destination(
    connection: sqlite3.Connection,
    destination_id: int,
) -> NotificationDelivery:
    row = connection.execute(
        "SELECT * FROM notification_destinations WHERE id = ?",
        (destination_id,),
    ).fetchone()
    if row is None:
        raise ValueError("Destination not found.")

    status = "delivered"
    context = f"Test notification sent to {row['target']}."

    if row["channel"] in {"webhook", "slack", "teams"}:
        payload = b'{"source":"TokenOps","type":"test","message":"Test notification"}'
        req = urlrequest.Request(
            row["target"],
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=3):
                pass
        except URLError:
            status = "failed"
            context = f"Test delivery to {row['target']} could not be completed from the local environment."

    return record_notification_delivery(
        connection,
        rule_name=f"Test: {row['name']}",
        channel=row["channel"],
        severity="low",
        context=context,
        status=status,
    )


def list_alert_rules(connection: sqlite3.Connection) -> list[AlertRule]:
    rows = connection.execute(
        "SELECT * FROM alert_rules ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [
        AlertRule(
            id=row["id"],
            name=row["name"],
            rule_type=row["rule_type"],
            severity=row["severity"],
            channel=row["channel"],
            threshold=row["threshold"],
            window_minutes=row["window_minutes"],
            enabled=bool(row["enabled"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


def create_alert_rule(connection: sqlite3.Connection, payload: AlertRuleCreate) -> AlertRule:
    created_at = datetime.now(UTC).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO alert_rules (
            name, rule_type, severity, channel, threshold, window_minutes, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.name,
            payload.rule_type,
            payload.severity,
            payload.channel,
            payload.threshold,
            payload.window_minutes,
            int(payload.enabled),
            created_at,
        ),
    )
    connection.commit()
    return AlertRule(
        id=cursor.lastrowid,
        name=payload.name,
        rule_type=payload.rule_type,
        severity=payload.severity,
        channel=payload.channel,
        threshold=payload.threshold,
        window_minutes=payload.window_minutes,
        enabled=payload.enabled,
        created_at=created_at,
    )


def update_alert_rule(connection: sqlite3.Connection, rule_id: int, enabled: bool) -> AlertRule:
    connection.execute(
        "UPDATE alert_rules SET enabled = ? WHERE id = ?",
        (int(enabled), rule_id),
    )
    connection.commit()
    row = connection.execute("SELECT * FROM alert_rules WHERE id = ?", (rule_id,)).fetchone()
    return AlertRule(
        id=row["id"],
        name=row["name"],
        rule_type=row["rule_type"],
        severity=row["severity"],
        channel=row["channel"],
        threshold=row["threshold"],
        window_minutes=row["window_minutes"],
        enabled=bool(row["enabled"]),
        created_at=row["created_at"],
    )


def create_event(connection: sqlite3.Connection, payload: TelemetryEventCreate) -> TelemetryEvent:
    timestamp = (payload.timestamp or datetime.now(UTC)).astimezone(UTC).replace(microsecond=0)
    total_tokens = payload.tokens_in + payload.tokens_out
    redacted_prompt = redact_prompt(payload.prompt_text)
    request_id = f"req_{uuid4().hex[:12]}"
    cursor = connection.execute(
        """
        INSERT INTO telemetry_events (
            request_id, timestamp, team, user_id, application, environment, endpoint,
            provider, model, prompt_name, prompt_version, prompt_text_redacted, tokens_in,
            tokens_out, total_tokens, cost, latency_ms, ttft_ms, stream_duration_ms,
            status, cache_hit, error_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            request_id,
            timestamp.isoformat(),
            payload.team,
            payload.user_id,
            payload.application,
            payload.environment,
            payload.endpoint,
            payload.provider,
            payload.model,
            payload.prompt_name,
            payload.prompt_version,
            redacted_prompt,
            payload.tokens_in,
            payload.tokens_out,
            total_tokens,
            payload.cost,
            payload.latency_ms,
            payload.ttft_ms,
            payload.stream_duration_ms,
            payload.status,
            int(payload.cache_hit),
            payload.error_type,
        ),
    )
    connection.commit()
    row = connection.execute(
        "SELECT * FROM telemetry_events WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    created_event = _row_to_event(row)
    _record_triggered_notifications(connection)
    return created_event


def validate_api_key(connection: sqlite3.Connection, raw_key: str) -> Project | None:
    hashed = sha256(raw_key.encode("utf-8")).hexdigest()
    row = connection.execute(
        """
        SELECT projects.*
        FROM api_keys
        JOIN projects ON projects.id = api_keys.project_id
        WHERE api_keys.hashed_key = ? AND api_keys.is_active = 1
        """,
        (hashed,),
    ).fetchone()
    if row is None:
        return None
    return Project(
        id=row["id"],
        name=row["name"],
        team=row["team"],
        environment=row["environment"],
        budget_monthly=row["budget_monthly"],
        created_at=row["created_at"],
    )


def list_projects(connection: sqlite3.Connection) -> list[Project]:
    rows = connection.execute("SELECT * FROM projects ORDER BY name ASC").fetchall()
    return [
        Project(
            id=row["id"],
            name=row["name"],
            team=row["team"],
            environment=row["environment"],
            budget_monthly=row["budget_monthly"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


def list_api_keys(connection: sqlite3.Connection) -> list[ApiKey]:
    rows = connection.execute(
        """
        SELECT api_keys.*, projects.name AS project_name
        FROM api_keys
        JOIN projects ON projects.id = api_keys.project_id
        ORDER BY api_keys.created_at DESC, api_keys.id DESC
        """
    ).fetchall()
    return [
        ApiKey(
            id=row["id"],
            label=row["label"],
            key_prefix=row["key_prefix"],
            project_id=row["project_id"],
            project_name=row["project_name"],
            is_active=bool(row["is_active"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]


def create_api_key(connection: sqlite3.Connection, payload: ApiKeyCreate) -> ApiKeyCreateResponse:
    raw_key = f"tok_live_{uuid4().hex[:24]}"
    hashed = sha256(raw_key.encode("utf-8")).hexdigest()
    created_at = datetime.now(UTC).isoformat()
    cursor = connection.execute(
        """
        INSERT INTO api_keys (label, key_prefix, hashed_key, project_id, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (payload.label, raw_key[:10], hashed, payload.project_id, 1, created_at),
    )
    connection.commit()
    project_row = connection.execute(
        "SELECT name FROM projects WHERE id = ?",
        (payload.project_id,),
    ).fetchone()
    return ApiKeyCreateResponse(
        api_key=ApiKey(
            id=cursor.lastrowid,
            label=payload.label,
            key_prefix=raw_key[:10],
            project_id=payload.project_id,
            project_name=project_row["name"],
            is_active=True,
            created_at=created_at,
        ),
        raw_key=raw_key,
    )


def set_api_key_status(connection: sqlite3.Connection, key_id: int, is_active: bool) -> ApiKey:
    connection.execute(
        "UPDATE api_keys SET is_active = ? WHERE id = ?",
        (int(is_active), key_id),
    )
    connection.commit()
    row = connection.execute(
        """
        SELECT api_keys.*, projects.name AS project_name
        FROM api_keys
        JOIN projects ON projects.id = api_keys.project_id
        WHERE api_keys.id = ?
        """,
        (key_id,),
    ).fetchone()
    return ApiKey(
        id=row["id"],
        label=row["label"],
        key_prefix=row["key_prefix"],
        project_id=row["project_id"],
        project_name=row["project_name"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


def replay_request(connection: sqlite3.Connection, payload: ReplayRequest) -> ReplayResult:
    source = connection.execute(
        "SELECT * FROM telemetry_events WHERE request_id = ?",
        (payload.request_id,),
    ).fetchone()
    if source is None:
        raise ValueError("Request ID not found.")

    replay_model = payload.compare_model or source["model"]
    replay_latency_ms = max(320, int(source["latency_ms"] * (0.88 if replay_model != source["model"] else 0.96)))
    replay_cost = round(source["cost"] * (1.12 if replay_model == "gpt-4.1" else 0.91), 4)
    replay_event = create_event(
        connection,
        TelemetryEventCreate(
            timestamp=datetime.now(UTC),
            team=source["team"],
            user_id=source["user_id"],
            application=source["application"],
            environment=source["environment"],
            endpoint=source["endpoint"],
            provider=source["provider"],
            model=replay_model,
            prompt_name=source["prompt_name"],
            prompt_version=source["prompt_version"],
            prompt_text=source["prompt_text_redacted"],
            tokens_in=source["tokens_in"],
            tokens_out=source["tokens_out"],
            cost=replay_cost,
            latency_ms=replay_latency_ms,
            ttft_ms=max(120, int(replay_latency_ms * 0.27)),
            stream_duration_ms=max(200, int(replay_latency_ms * 0.73)),
            status="success",
            cache_hit=bool(source["cache_hit"]),
            error_type=None,
        ),
    )
    diff_summary = (
        "Replay reduced latency but slightly changed cost envelope."
        if replay_latency_ms < source["latency_ms"]
        else "Replay preserved behavior with near-identical latency."
    )
    return ReplayResult(
        source_request_id=source["request_id"],
        replay_request_id=replay_event.request_id,
        original_model=source["model"],
        replay_model=replay_model,
        original_latency_ms=source["latency_ms"],
        replay_latency_ms=replay_latency_ms,
        original_cost=source["cost"],
        replay_cost=replay_cost,
        output_diff_summary=diff_summary,
    )


def get_anomalies(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> list[AnomalyInsight]:
    rows = _query_events(connection, days, team, model, environment, application)
    prior_rows = _query_events(connection, days * 2, team, model, environment, application)
    current_cutoff = datetime.now(UTC) - timedelta(days=days)
    comparison_rows = [row for row in prior_rows if datetime.fromisoformat(row["timestamp"]) < current_cutoff]

    anomalies: list[AnomalyInsight] = []
    if not rows or not comparison_rows:
        return anomalies

    current_error_rate = sum(1 for row in rows if row["status"] != "success") / len(rows) * 100
    prior_error_rate = sum(1 for row in comparison_rows if row["status"] != "success") / len(comparison_rows) * 100
    if current_error_rate > prior_error_rate + 2:
        anomalies.append(
            AnomalyInsight(
                kind="error-rate",
                severity="high",
                title="Error rate regression",
                context="The selected slice is failing materially more often than the prior baseline window.",
                metric_value=f"{current_error_rate:.1f}% vs {prior_error_rate:.1f}%",
            )
        )

    current_p95 = _percentile([row["latency_ms"] for row in rows], 95)
    prior_p95 = _percentile([row["latency_ms"] for row in comparison_rows], 95)
    if current_p95 > prior_p95 + 250:
        anomalies.append(
            AnomalyInsight(
                kind="latency",
                severity="medium",
                title="Latency drift detected",
                context="P95 latency moved meaningfully above the recent baseline.",
                metric_value=f"{current_p95}ms vs {prior_p95}ms",
            )
        )

    current_cache = sum(row["cache_hit"] for row in rows) / len(rows) * 100
    prior_cache = sum(row["cache_hit"] for row in comparison_rows) / len(comparison_rows) * 100
    if current_cache < prior_cache - 5:
        anomalies.append(
            AnomalyInsight(
                kind="cache",
                severity="medium",
                title="Cache efficiency dropped",
                context="Prompt or embedding reuse is underperforming compared with the prior period.",
                metric_value=f"{current_cache:.1f}% vs {prior_cache:.1f}%",
            )
        )

    current_cost = sum(row["cost"] for row in rows)
    prior_cost = sum(row["cost"] for row in comparison_rows)
    if current_cost > prior_cost * 1.18:
        anomalies.append(
            AnomalyInsight(
                kind="spend",
                severity="medium",
                title="Spend acceleration",
                context="Observed AI spend is growing faster than the prior window baseline.",
                metric_value=f"{_format_currency(current_cost)} vs {_format_currency(prior_cost)}",
            )
        )

    return anomalies


def export_events_csv(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> str:
    rows = _query_events(connection, days, team, model, environment, application)
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "request_id",
            "timestamp",
            "team",
            "application",
            "environment",
            "endpoint",
            "provider",
            "model",
            "prompt_name",
            "prompt_version",
            "total_tokens",
            "cost",
            "latency_ms",
            "status",
            "cache_hit",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["request_id"],
                row["timestamp"],
                row["team"],
                row["application"],
                row["environment"],
                row["endpoint"],
                row["provider"],
                row["model"],
                row["prompt_name"],
                row["prompt_version"],
                row["total_tokens"],
                row["cost"],
                row["latency_ms"],
                row["status"],
                row["cache_hit"],
            ]
        )
    return output.getvalue()


def get_team_benchmarks(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> list[BenchmarkEntry]:
    rows = _query_events(connection, days, team, model, environment, application)
    grouped: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        grouped.setdefault(row["team"], []).append(row)

    benchmarks: list[BenchmarkEntry] = []
    for team_name, team_rows in grouped.items():
        total = len(team_rows)
        success_rate = sum(1 for row in team_rows if row["status"] == "success") / total * 100
        avg_cost = sum(row["cost"] for row in team_rows) / total
        p95_latency = _percentile([row["latency_ms"] for row in team_rows], 95)
        cache_rate = sum(row["cache_hit"] for row in team_rows) / total * 100
        efficiency_score = max(70, min(99, int(success_rate - (avg_cost * 120) + (cache_rate * 0.18))))
        benchmarks.append(
            BenchmarkEntry(
                team=team_name,
                efficiency_score=efficiency_score,
                avg_cost_per_request=f"${avg_cost:.3f}",
                p95_latency=f"{p95_latency}ms",
                success_rate=f"{success_rate:.1f}%",
            )
        )
    return sorted(benchmarks, key=lambda item: item.efficiency_score, reverse=True)


def get_recommendations(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> list[Recommendation]:
    rows = _query_events(connection, days, team, model, environment, application)
    if not rows:
        return []

    recommendations: list[Recommendation] = []
    model_comparison = _build_model_comparison(rows)
    prompts = _build_prompt_insights(rows)
    anomalies = get_anomalies(connection, days, team, model, environment, application)

    expensive_model = max(model_comparison, key=lambda item: _parse_compact_currency(item.avg_cost), default=None)
    if expensive_model and expensive_model.model == "gpt-4.1":
        recommendations.append(
            Recommendation(
                title="Route lightweight workloads to GPT-4.1-mini",
                priority="high",
                category="cost",
                rationale="GPT-4.1 is the most expensive model in the current slice and a large share of requests are low-risk operational flows.",
                projected_impact="Reduce blended model spend by 12-18%.",
            )
        )

    review_prompt = next((prompt for prompt in prompts if prompt.status == "Needs review"), None)
    if review_prompt:
        recommendations.append(
            Recommendation(
                title=f"Refine prompt {review_prompt.name} {review_prompt.version}",
                priority="medium",
                category="quality",
                rationale="This prompt version shows weaker success and latency posture than the rest of the fleet.",
                projected_impact="Reduce retries and latency regressions for the owning team.",
            )
        )

    for anomaly in anomalies[:2]:
        recommendations.append(
            Recommendation(
                title=f"Investigate {anomaly.title.lower()}",
                priority=anomaly.severity,
                category="operations",
                rationale=anomaly.context,
                projected_impact=f"Normalize {anomaly.metric_value}.",
            )
        )

    if not recommendations:
        recommendations.append(
            Recommendation(
                title="Expand cache coverage on stable prompts",
                priority="medium",
                category="latency",
                rationale="Current cache hit rates are healthy, but several stable prompt families are good candidates for more aggressive reuse.",
                projected_impact="Save 5-8% on spend and improve tail latency.",
            )
        )

    return recommendations[:5]


def get_quality_overview(
    connection: sqlite3.Connection,
    days: int,
    team: str | None,
    model: str | None,
    environment: str | None,
    application: str | None,
) -> QualityResponse:
    rows = _query_events(connection, days, team, model, environment, application)
    if not rows:
        return QualityResponse(metrics=[], risky_prompts=[], low_confidence_requests=[])

    success_rate = sum(1 for row in rows if row["status"] == "success") / len(rows) * 100
    cache_rate = sum(row["cache_hit"] for row in rows) / len(rows) * 100
    latency_p95 = _percentile([row["latency_ms"] for row in rows], 95)
    confidence_score = max(62, min(98, int(success_rate - ((latency_p95 - 1000) / 120) + cache_rate * 0.12)))
    hallucination_risk = max(2, min(18, round((100 - success_rate) * 0.8 + (100 - cache_rate) * 0.06, 1)))

    metrics = [
      QualityMetric(label="Confidence score", value=f"{confidence_score}/100", trend="derived from success, latency, and cache posture"),
      QualityMetric(label="Hallucination risk", value=f"{hallucination_risk:.1f}%", trend="heuristic operational risk estimate"),
      QualityMetric(label="Reliable responses", value=f"{success_rate:.1f}%", trend="successful requests in the current window"),
    ]

    prompt_rows = _build_prompt_insights(rows)
    risky_prompts: list[QualityPromptRisk] = []
    for prompt in prompt_rows[:6]:
        prompt_success = float(prompt.success_rate.replace("%", ""))
        prompt_latency = float(prompt.avg_latency.replace("s", ""))
        prompt_confidence = max(55, min(98, int(prompt_success - prompt_latency * 3.5)))
        prompt_risk = max(1.5, min(22, round((100 - prompt_success) * 0.9 + prompt_latency * 0.7, 1)))
        status = "Stable" if prompt_confidence >= 90 else "Review"
        risky_prompts.append(
            QualityPromptRisk(
                prompt_name=prompt.name,
                version=prompt.version,
                owner=prompt.owner,
                hallucination_risk=f"{prompt_risk:.1f}%",
                confidence_score=f"{prompt_confidence}/100",
                quality_status=status,
            )
        )

    low_confidence_requests = [
        row["request_id"]
        for row in rows
        if row["status"] != "success" or row["latency_ms"] > latency_p95 or row["cache_hit"] == 0
    ][:8]

    risky_prompts.sort(key=lambda item: float(item.hallucination_risk.replace("%", "")), reverse=True)
    return QualityResponse(
        metrics=metrics,
        risky_prompts=risky_prompts,
        low_confidence_requests=low_confidence_requests,
    )


def _record_triggered_notifications(connection: sqlite3.Connection) -> None:
    rules = list_alert_rules(connection)
    incidents = get_incidents(connection, 7, None, None, None, None)
    existing_contexts = {
        row["context"]
        for row in connection.execute(
            "SELECT context FROM notification_deliveries ORDER BY id DESC LIMIT 50"
        ).fetchall()
    }
    for incident in incidents:
        if incident.context in existing_contexts:
            continue
        matching_rule = next(
            (rule for rule in rules if rule.name == incident.title),
            None,
        )
        if matching_rule is None:
            continue
        record_notification_delivery(
            connection,
            rule_name=matching_rule.name,
            channel=matching_rule.channel,
            severity=matching_rule.severity,
            context=incident.context,
        )


def _row_to_event(row: sqlite3.Row) -> TelemetryEvent:
    return TelemetryEvent(
        id=row["id"],
        request_id=row["request_id"],
        timestamp=row["timestamp"],
        team=row["team"],
        user_id=row["user_id"],
        application=row["application"],
        environment=row["environment"],
        endpoint=row["endpoint"],
        provider=row["provider"],
        model=row["model"],
        prompt_name=row["prompt_name"],
        prompt_version=row["prompt_version"],
        prompt_text_redacted=row["prompt_text_redacted"],
        tokens_in=row["tokens_in"],
        tokens_out=row["tokens_out"],
        total_tokens=row["total_tokens"],
        cost=row["cost"],
        latency_ms=row["latency_ms"],
        ttft_ms=row["ttft_ms"],
        stream_duration_ms=row["stream_duration_ms"],
        status=row["status"],
        cache_hit=bool(row["cache_hit"]),
        error_type=row["error_type"],
    )
    BenchmarkEntry,
