"use client";

import { useState } from "react";

import { replayRequest } from "@/lib/api";
import type { ReplayResult } from "@/lib/types";

type ReplayPanelProps = {
  suggestedRequestId?: string;
};

export function ReplayPanel({ suggestedRequestId = "" }: ReplayPanelProps) {
  const [requestId, setRequestId] = useState(suggestedRequestId);
  const [compareModel, setCompareModel] = useState("gpt-4.1");
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleReplay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setError(null);
    try {
      const replay = await replayRequest({
        request_id: requestId,
        compare_model: compareModel,
      });
      setResult(replay);
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Unable to replay request.");
    } finally {
      setIsRunning(false);
    }
  }

  const inputClassName =
    "rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40";

  return (
    <section className="rounded-[26px] border border-white/8 bg-white/5 p-5">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Replay engine</p>
      <h2 className="mt-2 font-space-grotesk text-2xl font-semibold text-white">
        Replay an existing request
      </h2>
      <form onSubmit={handleReplay} className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
        <input
          className={inputClassName}
          value={requestId}
          onChange={(event) => setRequestId(event.target.value)}
          placeholder="req_..."
        />
        <select
          className={inputClassName}
          value={compareModel}
          onChange={(event) => setCompareModel(event.target.value)}
        >
          {["gpt-4.1", "gpt-4.1-mini", "claude-sonnet", "gemini-flash"].map((model) => (
            <option key={model} value={model} className="bg-slate-900">
              {model}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isRunning || !requestId}
          className="rounded-2xl bg-white px-4 py-3 font-medium text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {isRunning ? "Replaying..." : "Replay request"}
        </button>
      </form>
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {result ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
            <p className="text-sm text-slate-400">Replay request</p>
            <p className="mt-2 text-white">{result.replay_request_id}</p>
          </div>
            <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
              <p className="text-sm text-slate-400">Latency delta</p>
              <p className="mt-2 text-white">
                {result.original_latency_ms}
                ms {"->"} {result.replay_latency_ms}
                ms
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
              <p className="text-sm text-slate-400">Cost delta</p>
              <p className="mt-2 text-white">
                ${result.original_cost.toFixed(4)} {"->"} ${result.replay_cost.toFixed(4)}
              </p>
            </div>
          <div className="rounded-2xl border border-white/8 bg-[#0c1625] p-4">
            <p className="text-sm text-slate-400">Summary</p>
            <p className="mt-2 text-white">{result.output_diff_summary}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
