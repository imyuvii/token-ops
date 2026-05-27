import { AppShell } from "@/components/app-shell";
import { EventIngestForm } from "@/components/event-ingest-form";

const nodeSnippet = `import { tokenops } from "./tokenops";

await tokenops.track({
  team: "Customer Ops",
  userId: "agent-7",
  application: "support-bot",
  environment: "production",
  endpoint: "/api/assist/reply",
  provider: "OpenAI",
  model: "gpt-4.1-mini",
  promptName: "support_resolution",
  promptVersion: "v4.0",
  promptText: "Summarize customer thread jane@example.com 12345678",
  tokensIn: 1200,
  tokensOut: 420,
  cost: 0.021,
  latencyMs: 1180,
  ttftMs: 290,
  streamDurationMs: 890,
  status: "success",
  cacheHit: true
});`;

const pythonSnippet = `from tokenops import TokenOps

client = TokenOps("http://localhost:8000")
client.track(
    team="Customer Ops",
    user_id="agent-7",
    application="support-bot",
    environment="production",
    endpoint="/api/assist/reply",
    provider="OpenAI",
    model="gpt-4.1-mini",
    prompt_name="support_resolution",
    prompt_version="v4.0",
    prompt_text="Summarize customer thread jane@example.com 12345678",
    tokens_in=1200,
    tokens_out=420,
    cost=0.021,
    latency_ms=1180,
    ttft_ms=290,
    stream_duration_ms=890,
    status="success",
    cache_hit=True,
)`;

export default function IngestPage() {
  return (
    <AppShell
      active="ingest"
      title="Ingest telemetry into TokenOps"
      description="Send AI request telemetry, verify prompt redaction, and bootstrap integrations using the included SDK samples."
    >
      <EventIngestForm />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Node SDK</p>
          <pre className="mt-4 overflow-x-auto rounded-[22px] border border-white/8 bg-[#0c1625] p-4 text-sm text-slate-200">
            <code>{nodeSnippet}</code>
          </pre>
        </section>

        <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Python SDK</p>
          <pre className="mt-4 overflow-x-auto rounded-[22px] border border-white/8 bg-[#0c1625] p-4 text-sm text-slate-200">
            <code>{pythonSnippet}</code>
          </pre>
        </section>
      </div>
    </AppShell>
  );
}
