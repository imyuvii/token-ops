from __future__ import annotations

import random
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).with_name("tokenops.db")


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS telemetry_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id TEXT NOT NULL UNIQUE,
                timestamp TEXT NOT NULL,
                team TEXT NOT NULL,
                user_id TEXT NOT NULL,
                application TEXT NOT NULL,
                environment TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_name TEXT NOT NULL,
                prompt_version TEXT NOT NULL,
                prompt_text_redacted TEXT NOT NULL,
                tokens_in INTEGER NOT NULL,
                tokens_out INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                cost REAL NOT NULL,
                latency_ms INTEGER NOT NULL,
                ttft_ms INTEGER NOT NULL,
                stream_duration_ms INTEGER NOT NULL,
                status TEXT NOT NULL,
                cache_hit INTEGER NOT NULL DEFAULT 0,
                error_type TEXT
            );

            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                channel TEXT NOT NULL,
                threshold REAL NOT NULL,
                window_minutes INTEGER NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );
            """
        )

        event_count = connection.execute("SELECT COUNT(*) FROM telemetry_events").fetchone()[0]
        if event_count == 0:
            seed_events(connection)

        rule_count = connection.execute("SELECT COUNT(*) FROM alert_rules").fetchone()[0]
        if rule_count == 0:
            seed_alert_rules(connection)


def seed_events(connection: sqlite3.Connection) -> None:
    random.seed(14)

    teams = {
        "Customer Ops": ["support_resolution", "ticket_autofill"],
        "Fraud Platform": ["risk_summary", "chargeback_review"],
        "Revenue Systems": ["sales_briefing", "forecast_digest"],
        "Internal Search": ["knowledge_answer", "retrieval_rerank"],
    }
    applications = {
        "Customer Ops": "support-bot",
        "Fraud Platform": "fraud-analyzer",
        "Revenue Systems": "sales-copilot",
        "Internal Search": "knowledge-hub",
    }
    endpoints = {
        "support-bot": ["/api/assist/reply", "/api/tickets/summarize"],
        "fraud-analyzer": ["/api/risk/score", "/api/disputes/review"],
        "sales-copilot": ["/api/sales/brief", "/api/account/next-step"],
        "knowledge-hub": ["/api/search/answer", "/api/search/re-rank"],
    }
    models = [
        ("OpenAI", "gpt-4.1", 0.043, 2400),
        ("OpenAI", "gpt-4.1-mini", 0.016, 1280),
        ("Anthropic", "claude-sonnet", 0.029, 1980),
        ("Google", "gemini-flash", 0.012, 920),
    ]
    environments = ["production", "staging"]
    now = datetime.now(UTC)

    for day_offset in range(34):
        day = now - timedelta(days=day_offset)
        for index in range(44):
            team = random.choices(
                population=list(teams.keys()),
                weights=[0.36, 0.18, 0.24, 0.22],
                k=1,
            )[0]
            application = applications[team]
            provider, model, base_cost, base_latency = random.choice(models)
            prompt_name = random.choice(teams[team])
            prompt_version = f"v{random.randint(1, 3)}.{random.randint(0, 9)}"
            cache_hit = 1 if random.random() < 0.41 else 0
            status = "success" if random.random() > 0.07 else "error"
            tokens_in = random.randint(450, 2800)
            tokens_out = random.randint(160, 1200)
            total_tokens = tokens_in + tokens_out
            cost = round((total_tokens / 1000) * base_cost * (0.72 if cache_hit else 1.0), 4)
            latency_ms = max(
                420,
                int(
                    random.gauss(
                        base_latency * (0.82 if cache_hit else 1.0),
                        180 if cache_hit else 260,
                    )
                ),
            )
            ttft_ms = max(120, int(latency_ms * random.uniform(0.18, 0.36)))
            stream_duration_ms = max(200, latency_ms - ttft_ms)
            environment = random.choices(environments, weights=[0.84, 0.16], k=1)[0]
            endpoint = random.choice(endpoints[application])
            error_type = None if status == "success" else random.choice(
                ["timeout", "provider_overload", "validation_error"]
            )
            timestamp = day.replace(
                hour=(index * 3) % 24,
                minute=random.randint(0, 59),
                second=random.randint(0, 59),
                microsecond=0,
            )
            request_id = f"req_{day_offset:02d}_{index:03d}_{random.randint(1000, 9999)}"
            prompt_text_redacted = (
                f"{prompt_name} request for {application} using [REDACTED_EMAIL] and [REDACTED_NUMBER]"
            )

            connection.execute(
                """
                INSERT INTO telemetry_events (
                    request_id, timestamp, team, user_id, application, environment, endpoint,
                    provider, model, prompt_name, prompt_version, prompt_text_redacted,
                    tokens_in, tokens_out, total_tokens, cost, latency_ms, ttft_ms,
                    stream_duration_ms, status, cache_hit, error_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request_id,
                    timestamp.isoformat(),
                    team,
                    f"user-{random.randint(1, 28):02d}",
                    application,
                    environment,
                    endpoint,
                    provider,
                    model,
                    prompt_name,
                    prompt_version,
                    prompt_text_redacted,
                    tokens_in,
                    tokens_out,
                    total_tokens,
                    cost,
                    latency_ms,
                    ttft_ms,
                    stream_duration_ms,
                    status,
                    cache_hit,
                    error_type,
                ),
            )

        connection.commit()


def seed_alert_rules(connection: sqlite3.Connection) -> None:
    created_at = datetime.now(UTC).isoformat()
    rules = [
        ("Monthly spend guardrail", "budget", "medium", "slack", 12500, 43200, 1, created_at),
        ("P95 latency threshold", "latency", "high", "email", 2500, 240, 1, created_at),
        ("Error rate regression", "error_rate", "high", "webhook", 6.0, 180, 1, created_at),
        ("Cache hit floor", "cache_hit", "low", "slack", 35.0, 1440, 1, created_at),
    ]
    connection.executemany(
        """
        INSERT INTO alert_rules (
            name, rule_type, severity, channel, threshold, window_minutes, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rules,
    )
    connection.commit()
