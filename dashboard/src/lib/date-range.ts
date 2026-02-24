/**
 * Date range utilities — shared between server and client components
 */

export type RangeValue = "1d" | "7d" | "30d" | "90d";

export const RANGE_OPTIONS = [
  { value: "1d" as const, label: "Today" },
  { value: "7d" as const, label: "Last 7 days" },
  { value: "30d" as const, label: "Last 30 days" },
  { value: "90d" as const, label: "Last 90 days" },
];

export function rangeToMs(range: RangeValue): number {
  const map: Record<RangeValue, number> = {
    "1d": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return map[range];
}

export function parseRange(param: string | null): RangeValue {
  if (param && ["1d", "7d", "30d", "90d"].includes(param)) {
    return param as RangeValue;
  }
  return "7d";
}

export function rangeLabel(range: RangeValue): string {
  return RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "Last 7 days";
}
