import type {
  AlertIncident,
  AlertRule,
  AlertRuleCreate,
  DashboardFilters,
  DashboardResponse,
  ModelComparison,
  PromptInsight,
  TelemetryEvent,
  TelemetryEventCreate,
} from "@/lib/types";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function buildQuery(filters?: DashboardFilters): string {
  const params = new URLSearchParams();
  if (!filters) return "";

  if (filters.days) params.set("days", String(filters.days));
  if (filters.team) params.set("team", filters.team);
  if (filters.model) params.set("model", filters.model);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.application) params.set("application", filters.application);

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function getDashboardData(filters?: DashboardFilters): Promise<DashboardResponse> {
  return fetchJson<DashboardResponse>(`/api/v1/dashboard${buildQuery(filters)}`);
}

export async function getRecentEvents(filters?: DashboardFilters): Promise<TelemetryEvent[]> {
  return fetchJson<TelemetryEvent[]>(`/api/v1/events${buildQuery(filters)}`);
}

export async function getPromptInsights(filters?: DashboardFilters): Promise<PromptInsight[]> {
  return fetchJson<PromptInsight[]>(`/api/v1/prompts${buildQuery(filters)}`);
}

export async function getModelComparison(filters?: DashboardFilters): Promise<ModelComparison[]> {
  return fetchJson<ModelComparison[]>(`/api/v1/models${buildQuery(filters)}`);
}

export async function getAlertRules(): Promise<AlertRule[]> {
  return fetchJson<AlertRule[]>("/api/v1/alerts/rules");
}

export async function getAlertIncidents(filters?: DashboardFilters): Promise<AlertIncident[]> {
  return fetchJson<AlertIncident[]>(`/api/v1/alerts/incidents${buildQuery(filters)}`);
}

export async function createAlertRule(payload: AlertRuleCreate): Promise<AlertRule> {
  const response = await fetch(`${API_BASE_URL}/api/v1/alerts/rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Unable to create alert rule.");
  }

  return response.json() as Promise<AlertRule>;
}

export async function toggleAlertRule(ruleId: number, enabled: boolean): Promise<AlertRule> {
  const response = await fetch(`${API_BASE_URL}/api/v1/alerts/rules/${ruleId}?enabled=${enabled}`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("Unable to update alert rule.");
  }

  return response.json() as Promise<AlertRule>;
}

export async function createTelemetryEvent(
  payload: TelemetryEventCreate
): Promise<TelemetryEvent> {
  const response = await fetch(`${API_BASE_URL}/api/v1/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Unable to ingest telemetry event.");
  }

  return response.json() as Promise<TelemetryEvent>;
}

