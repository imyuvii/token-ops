import type {
  AlertIncident,
  AlertRule,
  AlertRuleCreate,
  AnomalyInsight,
  ApiKey,
  ApiKeyCreate,
  ApiKeyCreateResponse,
  DashboardFilters,
  DashboardResponse,
  ModelComparison,
  NotificationDelivery,
  Organization,
  Project,
  PromptInsight,
  ReplayRequest,
  ReplayResult,
  TelemetryEvent,
  TelemetryEventCreate,
  Member,
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

export async function getProjects(): Promise<Project[]> {
  return fetchJson<Project[]>("/api/v1/projects");
}

export async function getApiKeys(): Promise<ApiKey[]> {
  return fetchJson<ApiKey[]>("/api/v1/api-keys");
}

export async function createApiKey(payload: ApiKeyCreate): Promise<ApiKeyCreateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Unable to create API key.");
  }
  return response.json() as Promise<ApiKeyCreateResponse>;
}

export async function toggleApiKey(keyId: number, isActive: boolean): Promise<ApiKey> {
  const response = await fetch(`${API_BASE_URL}/api/v1/api-keys/${keyId}?is_active=${isActive}`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error("Unable to update API key.");
  }
  return response.json() as Promise<ApiKey>;
}

export async function replayRequest(payload: ReplayRequest): Promise<ReplayResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/replay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Unable to replay request.");
  }
  return response.json() as Promise<ReplayResult>;
}

export async function getAnomalies(filters?: DashboardFilters): Promise<AnomalyInsight[]> {
  return fetchJson<AnomalyInsight[]>(`/api/v1/anomalies${buildQuery(filters)}`);
}

export async function getNotifications(): Promise<NotificationDelivery[]> {
  return fetchJson<NotificationDelivery[]>("/api/v1/notifications");
}

export async function getOrganization(): Promise<Organization> {
  return fetchJson<Organization>("/api/v1/organization");
}

export async function getMembers(): Promise<Member[]> {
  return fetchJson<Member[]>("/api/v1/members");
}
