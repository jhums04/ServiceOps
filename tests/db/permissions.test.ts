import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  FAIRVIEW_ID,
  memberIdFor,
  serviceClient,
  signInAs,
  users,
} from "./clients";

const service = serviceClient();

describe("technician permissions", () => {
  let alex: SupabaseClient<Database>;
  let alexId: string;
  let jennaId: string;

  beforeAll(async () => {
    alex = await signInAs(users.alex);
    [alexId, jennaId] = await Promise.all([
      memberIdFor(users.alex),
      memberIdFor(users.jenna),
    ]);
  });

  it("sees only jobs assigned to them", async () => {
    const { data, error } = await alex.from("jobs").select("id, technician_id");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((job) => job.technician_id === alexId)).toBe(true);
  });

  it("cannot select another technician's jobs", async () => {
    const { data: jennaJobs } = await service
      .from("jobs")
      .select("id")
      .eq("technician_id", jennaId);
    expect(jennaJobs?.length).toBeGreaterThan(0);

    const { data, error } = await alex
      .from("jobs")
      .select("id")
      .in(
        "id",
        (jennaJobs ?? []).map((job) => job.id),
      );
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot select unassigned jobs", async () => {
    const { count: unassigned } = await service
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", FAIRVIEW_ID)
      .is("technician_id", null);
    expect(unassigned).toBeGreaterThan(0);

    const { count } = await alex
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .is("technician_id", null);
    expect(count).toBe(0);
  });

  it("cannot select any invoices or payments", async () => {
    for (const table of ["invoices", "payments"] as const) {
      const { count: existing } = await service
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", FAIRVIEW_ID);
      expect(existing).toBeGreaterThan(0);

      const { data, error } = await alex.from(table).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("sees only customers of jobs assigned to them", async () => {
    const { data: jobs } = await alex.from("jobs").select("customer_id");
    const expected = new Set((jobs ?? []).map((job) => job.customer_id));

    const { data: customers, error } = await alex
      .from("customers")
      .select("id");
    expect(error).toBeNull();
    expect(new Set((customers ?? []).map((customer) => customer.id))).toEqual(
      expected,
    );
  });

  it("cannot create customers or change jobs directly", async () => {
    const insert = await alex
      .from("customers")
      .insert({ organization_id: FAIRVIEW_ID, name: "Not allowed" })
      .select();
    expect(insert.error?.code).toBe("42501");

    const { data: job } = await alex
      .from("jobs")
      .select("id")
      .limit(1)
      .single();
    const update = await alex
      .from("jobs")
      .update({ price_cents: 1 })
      .eq("id", job?.id ?? "")
      .select();
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);
  });
});

describe("administrator permissions", () => {
  let admin: SupabaseClient<Database>;

  beforeAll(async () => {
    admin = await signInAs(users.fairviewAdmin);
  });

  it("reads all jobs, invoices, and payments of the organization", async () => {
    for (const table of ["jobs", "invoices", "payments"] as const) {
      const [{ count: expected }, { count, error }] = await Promise.all([
        service
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", FAIRVIEW_ID),
        admin.from(table).select("id", { count: "exact", head: true }),
      ]);
      expect(error).toBeNull();
      expect(count).toBe(expected);
    }
  });

  it("cannot change an issued invoice or a member's role", async () => {
    const { data: invoice } = await admin
      .from("invoices")
      .select("id")
      .limit(1)
      .single();
    const invoiceUpdate = await admin
      .from("invoices")
      .update({ amount_cents: 1 })
      .eq("id", invoice?.id ?? "");
    expect(invoiceUpdate.error?.code).toBe("42501");

    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .limit(1)
      .single();
    const roleUpdate = await admin
      .from("organization_members")
      .update({ role: "admin" })
      .eq("id", member?.id ?? "");
    expect(roleUpdate.error?.code).toBe("42501");
  });

  it("cannot read processed Stripe events or reset demo data", async () => {
    const events = await admin.from("stripe_webhook_events").select("id");
    expect(events.error?.code).toBe("42501");

    const reset = await admin.rpc("reset_demo_data");
    expect(reset.error?.code).toBe("42501");
  });
});
