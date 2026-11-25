import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { DashboardRange } from "./range";

const ACTIVITY_KINDS = [
  "job_scheduled",
  "job_completed",
  "invoice_issued",
  "payment_received",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityItem = {
  kind: ActivityKind;
  occurredAt: string;
  jobId: string | null;
  invoiceId: string | null;
  service: string;
  customerName: string;
  invoiceNumber: number | null;
  amountCents: number | null;
};

const UPCOMING_LIMIT = 8;
const ACTIVITY_LIMIT = 10;

export async function getDashboard(range: DashboardRange) {
  const supabase = await createClient();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const [summary, series, upcoming, activity] = await Promise.all([
    supabase
      .rpc("dashboard_summary", { p_from: range.from, p_to: range.to })
      .single(),
    supabase.rpc("revenue_series", {
      p_from: range.from,
      p_to: range.to,
      p_bucket: range.bucket,
    }),
    supabase
      .from("jobs")
      .select(
        "id, service, starts_at, ends_at, customer:customers (name), technician:organization_members (full_name)",
      )
      .eq("status", "scheduled")
      .gte("starts_at", now.toISOString())
      .lt("starts_at", weekAhead.toISOString())
      .order("starts_at")
      .order("id")
      .limit(UPCOMING_LIMIT),
    supabase
      .from("activity_feed")
      .select(
        "kind, occurred_at, job_id, invoice_id, service, customer_name, invoice_number, amount_cents",
      )
      .order("occurred_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ]);

  if (summary.error) throw summary.error;
  if (series.error) throw series.error;
  if (upcoming.error) throw upcoming.error;
  if (activity.error) throw activity.error;

  return {
    summary: summary.data,
    series: series.data,
    upcoming: upcoming.data,
    activity: activity.data.flatMap((row): ActivityItem[] => {
      const kind = ACTIVITY_KINDS.find((candidate) => candidate === row.kind);
      // View columns are nullable in the generated types; every branch of the view
      // fills these, so a row without them is not an event worth showing.
      if (!kind || !row.occurred_at) return [];
      return [
        {
          kind,
          occurredAt: row.occurred_at,
          jobId: row.job_id,
          invoiceId: row.invoice_id,
          service: row.service ?? "",
          customerName: row.customer_name ?? "",
          invoiceNumber: row.invoice_number,
          amountCents: row.amount_cents,
        },
      ];
    }),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
