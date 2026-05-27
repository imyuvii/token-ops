import type { ReactNode } from "react";

type StatusPillProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
};

const tones = {
  neutral: "border-white/10 bg-white/6 text-slate-200",
  success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  warning: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  danger: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

export function StatusPill({ children, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
