import { addDays } from "@/lib/dates";

export const RANGE_PRESETS = ["7d", "30d", "90d", "12m"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const DEFAULT_RANGE: RangePreset = "30d";

export const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
};

export type DashboardRange = {
  /** First calendar day in range, organization time zone. */
  from: string;
  /** Day after the last calendar day in range. */
  to: string;
  bucket: "day" | "month";
};

/** Ranges end today, inclusive. The 12-month range starts on the first of a month so every bar is a full month. */
export function dashboardRange(
  preset: RangePreset,
  today: string,
): DashboardRange {
  const to = addDays(today, 1);
  switch (preset) {
    case "7d":
      return { from: addDays(today, -6), to, bucket: "day" };
    case "30d":
      return { from: addDays(today, -29), to, bucket: "day" };
    case "90d":
      return { from: addDays(today, -89), to, bucket: "day" };
    case "12m": {
      const [year = 0, month = 1] = today.split("-").map(Number);
      const start = new Date(Date.UTC(year, month - 1 - 11, 1));
      return { from: start.toISOString().slice(0, 10), to, bucket: "month" };
    }
  }
}
