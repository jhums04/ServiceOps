import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dashboardRange,
  RANGE_PRESETS,
  type DashboardRange,
} from "@/domains/dashboard/range";
import { todayInZone, toZonedDate, zonedDayRange } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

import {
  anonClient,
  FAIRVIEW_ID,
  LAKESIDE_ID,
  resetDemoData,
  serviceClient,
  signInAs,
  users,
} from "./clients";

const service = serviceClient();
let admin: SupabaseClient<Database>;

// Expected figures are recomputed from raw rows with the service client, independently
// of the SQL under test.
async function rawData(organizationId: string) {
  const [organization, payments, invoices, jobs] = await Promise.all([
    service
      .from("organizations")
      .select("time_zone")
      .eq("id", organizationId)
      .single(),
    service
      .from("payments")
      .select("amount_cents, paid_at")
      .eq("organization_id", organizationId),
    service
      .from("invoices")
      .select("amount_cents, status, due_on")
      .eq("organization_id", organizationId),
    service
      .from("jobs")
      .select("status, starts_at, completed_at")
      .eq("organization_id", organizationId),
  ]);
  for (const result of [organization, payments, invoices, jobs]) {
    if (result.error) throw result.error;
  }
  return {
    timeZone: organization.data?.time_zone ?? "",
    payments: payments.data ?? [],
    invoices: invoices.data ?? [],
    jobs: jobs.data ?? [],
  };
}

function expectedSummary(
  raw: Awaited<ReturnType<typeof rawData>>,
  range: DashboardRange,
) {
  const { start, end } = zonedDayRange(range.from, range.to, raw.timeZone);
  const inRange = (value: string | null) =>
    value !== null && new Date(value) >= start && new Date(value) < end;
  const now = Date.now();
  const today = todayInZone(raw.timeZone);
  const unpaid = raw.invoices.filter((invoice) => invoice.status === "unpaid");
  const paidInRange = raw.payments.filter((payment) =>
    inRange(payment.paid_at),
  );

  return {
    revenue_cents: paidInRange.reduce((sum, p) => sum + p.amount_cents, 0),
    payment_count: paidInRange.length,
    outstanding_cents: unpaid.reduce((sum, i) => sum + i.amount_cents, 0),
    outstanding_count: unpaid.length,
    overdue_count: unpaid.filter((invoice) => invoice.due_on < today).length,
    upcoming_jobs: raw.jobs.filter((job) => {
      const startsAt = new Date(job.starts_at).getTime();
      return (
        job.status === "scheduled" &&
        startsAt >= now &&
        startsAt < now + 7 * 86_400_000
      );
    }).length,
    completed_jobs: raw.jobs.filter(
      (job) => job.status === "completed" && inRange(job.completed_at),
    ).length,
  };
}

beforeAll(async () => {
  await resetDemoData();
  admin = await signInAs(users.fairviewAdmin);
});

afterAll(resetDemoData);

describe("dashboard_summary", () => {
  it.each(RANGE_PRESETS)(
    "matches figures computed from the seed data for %s",
    async (preset) => {
      const raw = await rawData(FAIRVIEW_ID);
      const range = dashboardRange(preset, todayInZone(raw.timeZone));

      const { data, error } = await admin
        .rpc("dashboard_summary", { p_from: range.from, p_to: range.to })
        .single();

      expect(error).toBeNull();
      expect(data).toEqual(expectedSummary(raw, range));
    },
  );

  it("has non-trivial seed values so the comparison means something", async () => {
    const raw = await rawData(FAIRVIEW_ID);
    const expected = expectedSummary(
      raw,
      dashboardRange("30d", todayInZone(raw.timeZone)),
    );
    expect(expected.revenue_cents).toBeGreaterThan(0);
    expect(expected.outstanding_count).toBeGreaterThan(0);
    expect(expected.overdue_count).toBeGreaterThan(0);
    expect(expected.upcoming_jobs).toBeGreaterThan(0);
    expect(expected.completed_jobs).toBeGreaterThan(0);
  });

  it("only counts the caller's organization", async () => {
    const lakesideAdmin = await signInAs(users.lakesideAdmin);
    const raw = await rawData(LAKESIDE_ID);
    const range = dashboardRange("90d", todayInZone(raw.timeZone));

    const { data } = await lakesideAdmin
      .rpc("dashboard_summary", { p_from: range.from, p_to: range.to })
      .single();

    expect(data).toEqual(expectedSummary(raw, range));
  });

  it("rejects technicians and anonymous callers", async () => {
    const technician = await signInAs(users.alex);
    const technicianResult = await technician.rpc("dashboard_summary", {
      p_from: "2026-01-01",
      p_to: "2026-02-01",
    });
    expect(technicianResult.error?.code).toBe("42501");

    const anonResult = await anonClient().rpc("dashboard_summary", {
      p_from: "2026-01-01",
      p_to: "2026-02-01",
    });
    expect(anonResult.error).not.toBeNull();
  });

  it("rejects an empty or inverted range", async () => {
    const { error } = await admin.rpc("dashboard_summary", {
      p_from: "2026-02-01",
      p_to: "2026-02-01",
    });
    expect(error?.code).toBe("22023");
  });
});

describe("revenue_series", () => {
  it.each(RANGE_PRESETS)(
    "returns every bucket with totals matching the seed data for %s",
    async (preset) => {
      const raw = await rawData(FAIRVIEW_ID);
      const range = dashboardRange(preset, todayInZone(raw.timeZone));
      const { start, end } = zonedDayRange(range.from, range.to, raw.timeZone);

      const expected = new Map<string, number>();
      for (const payment of raw.payments) {
        const paidAt = new Date(payment.paid_at);
        if (paidAt < start || paidAt >= end) continue;
        const day = toZonedDate(paidAt, raw.timeZone);
        const bucket = range.bucket === "day" ? day : `${day.slice(0, 7)}-01`;
        expected.set(
          bucket,
          (expected.get(bucket) ?? 0) + payment.amount_cents,
        );
      }

      const { data, error } = await admin.rpc("revenue_series", {
        p_from: range.from,
        p_to: range.to,
        p_bucket: range.bucket,
      });

      expect(error).toBeNull();
      const rows = data ?? [];
      expect(rows).toHaveLength(
        { "7d": 7, "30d": 30, "90d": 90, "12m": 12 }[preset],
      );
      expect(rows[0]?.bucket_start).toBe(range.from);
      for (const row of rows) {
        expect(row.revenue_cents).toBe(expected.get(row.bucket_start) ?? 0);
      }
      const total = rows.reduce((sum, row) => sum + row.revenue_cents, 0);
      const { data: summary } = await admin
        .rpc("dashboard_summary", { p_from: range.from, p_to: range.to })
        .single();
      expect(total).toBe(summary?.revenue_cents);
    },
  );

  it("rejects an unknown bucket", async () => {
    const { error } = await admin.rpc("revenue_series", {
      p_from: "2026-01-01",
      p_to: "2026-02-01",
      p_bucket: "week",
    });
    expect(error?.code).toBe("22023");
  });
});

describe("activity_feed", () => {
  it("returns the latest events of the caller's organization, newest first", async () => {
    const { data, error } = await admin
      .from("activity_feed")
      .select("kind, occurred_at, organization_id")
      .order("occurred_at", { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.organization_id === FAIRVIEW_ID)).toBe(true);
    const times = rows.map((row) => row.occurred_at ?? "");
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("shows technicians nothing about invoices or payments", async () => {
    const technician = await signInAs(users.alex);
    const { data } = await technician
      .from("activity_feed")
      .select("kind")
      .in("kind", ["invoice_issued", "payment_received"]);
    expect(data).toEqual([]);
  });
});

describe("row caps", () => {
  it("rejects customers beyond the cap, including concurrent inserts", async () => {
    const { count } = await service
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", FAIRVIEW_ID);
    const room = 100 - (count ?? 0);

    const { error: fillError } = await admin.from("customers").insert(
      Array.from({ length: room - 1 }, (_, index) => ({
        organization_id: FAIRVIEW_ID,
        name: `Cap test ${index}`,
      })),
    );
    expect(fillError).toBeNull();

    const second = await signInAs(users.fairviewAdmin);
    const results = await Promise.all(
      [admin, second].map((client, index) =>
        client
          .from("customers")
          .insert({ organization_id: FAIRVIEW_ID, name: `Last ${index}` }),
      ),
    );

    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expect(results.map((result) => result.error?.code)).toContain("54000");

    const { count: after } = await service
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", FAIRVIEW_ID);
    expect(after).toBe(100);
  });

  it("does not count other organizations' rows", async () => {
    const lakesideAdmin = await signInAs(users.lakesideAdmin);
    const { error } = await lakesideAdmin
      .from("customers")
      .insert({ organization_id: LAKESIDE_ID, name: "Still allowed" });
    expect(error).toBeNull();
  });
});
