import type { DashboardFilters } from "@/lib/types";

type RawSearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function parseDashboardFilters(searchParams: RawSearchParams): Promise<DashboardFilters> {
  const resolved = (await searchParams) ?? {};
  const days = Number(firstValue(resolved.days) ?? "30");

  return {
    days: Number.isFinite(days) ? days : 30,
    team: firstValue(resolved.team) || undefined,
    model: firstValue(resolved.model) || undefined,
    environment: firstValue(resolved.environment) || undefined,
    application: firstValue(resolved.application) || undefined,
  };
}

