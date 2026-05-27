export type MetricCard = {
  label: string;
  value: string;
  delta: string;
  trend: string;
  accent: string;
};

export type SpendPoint = {
  day: string;
  spend: number;
  requests: number;
};

export type LatencyCell = {
  hour: string;
  "gpt-4.1": number;
  "gpt-4.1-mini": number;
  "claude-sonnet": number;
  "gemini-flash": number;
};

export type ModelComparison = {
  model: string;
  provider: string;
  avg_cost: string;
  avg_latency: string;
  reliability: string;
  quality_score: number;
  cache_hit_rate: string;
  retry_rate: string;
};

export type PromptInsight = {
  name: string;
  version: string;
  owner: string;
  success_rate: string;
  avg_cost: string;
  avg_latency: string;
  status: string;
  requests: number;
};

export type AlertIncident = {
  title: string;
  severity: string;
  context: string;
  timestamp: string;
  status: string;
};

export type TeamUsage = {
  team: string;
  spend: string;
  tokens: string;
  requests: string;
  efficiency: string;
};

export type CacheSummary = {
  hit_rate: string;
  tokens_saved: string;
  cost_saved: string;
  latency_reduction: string;
};

export type RequestOverview = {
  endpoint: string;
  requests: number;
  error_rate: string;
  p95_latency: string;
};

export type FilterOptions = {
  teams: string[];
  models: string[];
  environments: string[];
  applications: string[];
};

export type DashboardResponse = {
  metrics: MetricCard[];
  spend_series: SpendPoint[];
  latency_heatmap: LatencyCell[];
  model_comparison: ModelComparison[];
  prompt_insights: PromptInsight[];
  alerts: AlertIncident[];
  team_usage: TeamUsage[];
  cache_summary: CacheSummary;
  request_overview: RequestOverview[];
  filters: FilterOptions;
};

export type TelemetryEvent = {
  id: number;
  request_id: string;
  timestamp: string;
  team: string;
  user_id: string;
  application: string;
  environment: string;
  endpoint: string;
  provider: string;
  model: string;
  prompt_name: string;
  prompt_version: string;
  prompt_text_redacted: string;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  ttft_ms: number;
  stream_duration_ms: number;
  status: string;
  cache_hit: boolean;
  error_type: string | null;
};

export type AlertRule = {
  id: number;
  name: string;
  rule_type: "budget" | "latency" | "error_rate" | "cache_hit";
  severity: "low" | "medium" | "high";
  channel: "slack" | "email" | "webhook" | "teams";
  threshold: number;
  window_minutes: number;
  enabled: boolean;
  created_at: string;
};

export type AlertRuleCreate = Omit<AlertRule, "id" | "created_at">;

export type TelemetryEventCreate = {
  timestamp?: string;
  team: string;
  user_id: string;
  application: string;
  environment: string;
  endpoint: string;
  provider: string;
  model: string;
  prompt_name: string;
  prompt_version: string;
  prompt_text: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  latency_ms: number;
  ttft_ms: number;
  stream_duration_ms: number;
  status: "success" | "error";
  cache_hit: boolean;
  error_type?: string | null;
};

export type DashboardFilters = {
  days?: number;
  team?: string;
  model?: string;
  environment?: string;
  application?: string;
};

export type Project = {
  id: number;
  name: string;
  team: string;
  environment: string;
  budget_monthly: number;
  created_at: string;
};

export type ApiKey = {
  id: number;
  label: string;
  key_prefix: string;
  project_id: number;
  project_name: string;
  is_active: boolean;
  created_at: string;
};

export type ApiKeyCreate = {
  label: string;
  project_id: number;
};

export type ApiKeyCreateResponse = {
  api_key: ApiKey;
  raw_key: string;
};

export type ReplayRequest = {
  request_id: string;
  temperature?: number | null;
  compare_model?: string | null;
};

export type ReplayResult = {
  source_request_id: string;
  replay_request_id: string;
  original_model: string;
  replay_model: string;
  original_latency_ms: number;
  replay_latency_ms: number;
  original_cost: number;
  replay_cost: number;
  output_diff_summary: string;
};

export type AnomalyInsight = {
  kind: string;
  severity: string;
  title: string;
  context: string;
  metric_value: string;
};

export type NotificationDelivery = {
  id: number;
  rule_name: string;
  channel: string;
  severity: string;
  status: string;
  context: string;
  created_at: string;
};

export type Organization = {
  id: number;
  name: string;
  plan: string;
  created_at: string;
};

export type Member = {
  id: number;
  name: string;
  email: string;
  role: string;
  team: string;
  created_at: string;
};

export type BenchmarkEntry = {
  team: string;
  efficiency_score: number;
  avg_cost_per_request: string;
  p95_latency: string;
  success_rate: string;
};

export type Recommendation = {
  title: string;
  priority: string;
  category: string;
  rationale: string;
  projected_impact: string;
};

export type QualityMetric = {
  label: string;
  value: string;
  trend: string;
};

export type QualitySignal = {
  label: string;
  value: string;
  status: string;
};

export type QualityPromptRisk = {
  prompt_name: string;
  version: string;
  owner: string;
  hallucination_risk: string;
  confidence_score: string;
  quality_status: string;
};

export type QualityResponse = {
  metrics: QualityMetric[];
  signal_breakdown: QualitySignal[];
  risky_prompts: QualityPromptRisk[];
  low_confidence_cases: {
    request_id: string;
    prompt_name: string;
    model: string;
    confidence_band: string;
    risk_reason: string;
    suggested_action: string;
  }[];
};

export type CurrentUser = {
  name: string;
  email: string;
  role: string;
  team: string;
};

export type NotificationDestination = {
  id: number;
  name: string;
  channel: "slack" | "email" | "webhook" | "teams";
  target: string;
  is_active: boolean;
  created_at: string;
};

export type NotificationDestinationCreate = {
  name: string;
  channel: "slack" | "email" | "webhook" | "teams";
  target: string;
};
