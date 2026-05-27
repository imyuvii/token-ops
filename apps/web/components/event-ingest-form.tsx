"use client";

import { useState } from "react";

import { createTelemetryEvent } from "@/lib/api";
import type { TelemetryEventCreate } from "@/lib/types";

const defaultPayload: TelemetryEventCreate = {
  team: "Customer Ops",
  user_id: "demo-user",
  application: "support-bot",
  environment: "production",
  endpoint: "/api/assist/reply",
  provider: "OpenAI",
  model: "gpt-4.1-mini",
  prompt_name: "support_resolution",
  prompt_version: "v4.0",
  prompt_text: "Summarize the ticket for customer jane@example.com and account 12345678",
  tokens_in: 1420,
  tokens_out: 382,
  cost: 0.024,
  latency_ms: 1310,
  ttft_ms: 320,
  stream_duration_ms: 990,
  status: "success",
  cache_hit: true,
  error_type: null,
};

export function EventIngestForm() {
  const [payload, setPayload] = useState<TelemetryEventCreate>(defaultPayload);
  const [result, setResult] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setError(null);

    try {
      const created = await createTelemetryEvent(payload);
      setResult(`Ingested ${created.request_id} with redacted prompt: ${created.prompt_text_redacted}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to ingest event.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField<Key extends keyof TelemetryEventCreate>(key: Key, value: TelemetryEventCreate[Key]) {
    setPayload((previous) => ({ ...previous, [key]: value }));
  }

  const inputClassName =
    "rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Telemetry payload</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["team", payload.team],
            ["application", payload.application],
            ["environment", payload.environment],
            ["endpoint", payload.endpoint],
            ["provider", payload.provider],
            ["model", payload.model],
            ["prompt_name", payload.prompt_name],
            ["prompt_version", payload.prompt_version],
            ["user_id", payload.user_id],
          ].map(([key, value]) => (
            <input
              key={key}
              className={inputClassName}
              value={value}
              onChange={(event) =>
                updateField(key as keyof TelemetryEventCreate, event.target.value as never)
              }
              placeholder={key}
            />
          ))}
        </div>
        <textarea
          className={`${inputClassName} min-h-32 w-full`}
          value={payload.prompt_text}
          onChange={(event) => updateField("prompt_text", event.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["tokens_in", payload.tokens_in],
            ["tokens_out", payload.tokens_out],
            ["cost", payload.cost],
            ["latency_ms", payload.latency_ms],
            ["ttft_ms", payload.ttft_ms],
            ["stream_duration_ms", payload.stream_duration_ms],
          ].map(([key, value]) => (
            <input
              key={key}
              className={inputClassName}
              type="number"
              step={key === "cost" ? "0.001" : "1"}
              value={value}
              onChange={(event) =>
                updateField(key as keyof TelemetryEventCreate, Number(event.target.value) as never)
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/5 p-4">
        <h3 className="font-space-grotesk text-xl font-semibold text-white">Submit event</h3>
        <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#0c1625] px-4 py-3 text-sm text-slate-300">
          Cache hit
          <input
            type="checkbox"
            checked={payload.cache_hit}
            onChange={(event) => updateField("cache_hit", event.target.checked)}
          />
        </label>
        <select
          className={inputClassName}
          value={payload.status}
          onChange={(event) => updateField("status", event.target.value as "success" | "error")}
        >
          <option value="success" className="bg-slate-900">success</option>
          <option value="error" className="bg-slate-900">error</option>
        </select>
        <input
          className={inputClassName}
          value={payload.error_type ?? ""}
          placeholder="error_type"
          onChange={(event) => updateField("error_type", event.target.value || null)}
        />
        {result ? <p className="rounded-2xl bg-emerald-300/10 p-3 text-sm text-emerald-200">{result}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-300/10 p-3 text-sm text-rose-200">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Ingest telemetry"}
        </button>
      </div>
    </form>
  );
}

