from __future__ import annotations

import math
import re
import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from schemas import (
    AlertIncident,
    AlertRule,
    AlertRuleCreate,
    CacheSummary,
    DashboardResponse,
    FilterOptions,
    LatencyCell,
    MetricCard,
    ModelComparison,
    PromptInsight,
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
    return _row_to_event(row)


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
