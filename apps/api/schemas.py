from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MetricCard(BaseModel):
    label: str
    value: str
    delta: str
    trend: str
    accent: str


class SpendPoint(BaseModel):
    day: str
    spend: float
    requests: int


class LatencyCell(BaseModel):
    hour: str
    gpt_4_1: int = Field(alias="gpt-4.1")
    gpt_4_1_mini: int = Field(alias="gpt-4.1-mini")
    claude_sonnet: int = Field(alias="claude-sonnet")
    gemini_flash: int = Field(alias="gemini-flash")


class ModelComparison(BaseModel):
    model: str
    provider: str
    avg_cost: str
    avg_latency: str
    reliability: str
    quality_score: int
    cache_hit_rate: str
    retry_rate: str


class PromptInsight(BaseModel):
    name: str
    version: str
    owner: str
    success_rate: str
    avg_cost: str
    avg_latency: str
    status: str
    requests: int


class AlertIncident(BaseModel):
    title: str
    severity: str
    context: str
    timestamp: str
    status: str


class TeamUsage(BaseModel):
    team: str
    spend: str
    tokens: str
    requests: str
    efficiency: str


class CacheSummary(BaseModel):
    hit_rate: str
    tokens_saved: str
    cost_saved: str
    latency_reduction: str


class RequestOverview(BaseModel):
    endpoint: str
    requests: int
    error_rate: str
    p95_latency: str


class FilterOptions(BaseModel):
    teams: list[str]
    models: list[str]
    environments: list[str]
    applications: list[str]


class DashboardResponse(BaseModel):
    metrics: list[MetricCard]
    spend_series: list[SpendPoint]
    latency_heatmap: list[LatencyCell]
    model_comparison: list[ModelComparison]
    prompt_insights: list[PromptInsight]
    alerts: list[AlertIncident]
    team_usage: list[TeamUsage]
    cache_summary: CacheSummary
    request_overview: list[RequestOverview]
    filters: FilterOptions


class TelemetryEventCreate(BaseModel):
    timestamp: datetime | None = None
    team: str
    user_id: str
    application: str
    environment: str
    endpoint: str
    provider: str
    model: str
    prompt_name: str
    prompt_version: str
    prompt_text: str
    tokens_in: int
    tokens_out: int
    cost: float
    latency_ms: int
    ttft_ms: int
    stream_duration_ms: int
    status: Literal["success", "error"]
    cache_hit: bool = False
    error_type: str | None = None


class TelemetryEvent(BaseModel):
    id: int
    request_id: str
    timestamp: str
    team: str
    user_id: str
    application: str
    environment: str
    endpoint: str
    provider: str
    model: str
    prompt_name: str
    prompt_version: str
    prompt_text_redacted: str
    tokens_in: int
    tokens_out: int
    total_tokens: int
    cost: float
    latency_ms: int
    ttft_ms: int
    stream_duration_ms: int
    status: str
    cache_hit: bool
    error_type: str | None


class AlertRuleCreate(BaseModel):
    name: str
    rule_type: Literal["budget", "latency", "error_rate", "cache_hit"]
    severity: Literal["low", "medium", "high"]
    channel: Literal["slack", "email", "webhook", "teams"]
    threshold: float
    window_minutes: int
    enabled: bool = True


class AlertRule(BaseModel):
    id: int
    name: str
    rule_type: str
    severity: str
    channel: str
    threshold: float
    window_minutes: int
    enabled: bool
    created_at: str


class Project(BaseModel):
    id: int
    name: str
    team: str
    environment: str
    budget_monthly: float
    created_at: str


class ApiKey(BaseModel):
    id: int
    label: str
    key_prefix: str
    project_id: int
    project_name: str
    is_active: bool
    created_at: str


class ApiKeyCreate(BaseModel):
    label: str
    project_id: int


class ApiKeyCreateResponse(BaseModel):
    api_key: ApiKey
    raw_key: str


class ReplayRequest(BaseModel):
    request_id: str
    temperature: float | None = None
    compare_model: str | None = None


class ReplayResult(BaseModel):
    source_request_id: str
    replay_request_id: str
    original_model: str
    replay_model: str
    original_latency_ms: int
    replay_latency_ms: int
    original_cost: float
    replay_cost: float
    output_diff_summary: str


class AnomalyInsight(BaseModel):
    kind: str
    severity: str
    title: str
    context: str
    metric_value: str


class NotificationDelivery(BaseModel):
    id: int
    rule_name: str
    channel: str
    severity: str
    status: str
    context: str
    created_at: str
