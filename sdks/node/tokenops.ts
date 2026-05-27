type TokenOpsTrackPayload = {
  timestamp?: string;
  team: string;
  userId: string;
  application: string;
  environment: string;
  endpoint: string;
  provider: string;
  model: string;
  promptName: string;
  promptVersion: string;
  promptText: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
  ttftMs: number;
  streamDurationMs: number;
  status: "success" | "error";
  cacheHit?: boolean;
  errorType?: string | null;
};

export class TokenOps {
  constructor(private readonly baseUrl: string) {}

  async track(payload: TokenOpsTrackPayload) {
    const response = await fetch(`${this.baseUrl}/api/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp: payload.timestamp,
        team: payload.team,
        user_id: payload.userId,
        application: payload.application,
        environment: payload.environment,
        endpoint: payload.endpoint,
        provider: payload.provider,
        model: payload.model,
        prompt_name: payload.promptName,
        prompt_version: payload.promptVersion,
        prompt_text: payload.promptText,
        tokens_in: payload.tokensIn,
        tokens_out: payload.tokensOut,
        cost: payload.cost,
        latency_ms: payload.latencyMs,
        ttft_ms: payload.ttftMs,
        stream_duration_ms: payload.streamDurationMs,
        status: payload.status,
        cache_hit: payload.cacheHit ?? false,
        error_type: payload.errorType ?? null,
      }),
    });

    if (!response.ok) {
      throw new Error(`TokenOps ingestion failed with status ${response.status}`);
    }

    return response.json();
  }
}

export const tokenops = new TokenOps("http://localhost:8000");

