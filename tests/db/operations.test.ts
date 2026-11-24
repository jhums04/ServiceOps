import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FAIRVIEW_ID,
  memberIdFor,
  resetDemoData,
  serviceClient,
  signInAs,
  users,
} from "./clients";

const service = serviceClient();

beforeAll(resetDemoData);
afterAll(resetDemoData);

describe("customer balances", () => {
  it("sums unpaid invoices per customer for administrators", async () => {
    const admin = await signInAs(users.fairviewAdmin);

    const { data: invoices } = await service
      .from("invoices")
      .select("amount_cents, jobs!inner(customer_id)")
      .eq("organization_id", FAIRVIEW_ID)
      .eq("status", "unpaid");
    const expected = new Map<string, number>();
    for (const invoice of invoices ?? []) {
      const customerId = invoice.jobs.customer_id;
      expected.set(
        customerId,
        (expected.get(customerId) ?? 0) + invoice.amount_cents,
      );
    }
    expect(expected.size).toBeGreaterThan(0);

    const { data: summaries, error } = await admin
      .from("customer_summaries")
      .select("id, outstanding_cents");
    expect(error).toBeNull();
    for (const summary of summaries ?? []) {
      expect(summary.outstanding_cents).toBe(
        expected.get(summary.id ?? "") ?? 0,
      );
    }
  });

  it("shows technicians no balances", async () => {
    const alex = await signInAs(users.alex);
    const { data } = await alex
      .from("customer_summaries")
      .select("outstanding_cents");
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((summary) => summary.outstanding_cents === 0)).toBe(
      true,
    );
  });
});

describe("members", () => {
  it("an administrator cannot deactivate their own account", async () => {
    const admin = await signInAs(users.fairviewAdmin);
    const { error } = await admin
      .from("organization_members")
      .update({ is_active: false })
      .eq("id", await memberIdFor(users.fairviewAdmin));
    expect(error?.code).toBe("23514");
  });

  it("an administrator can deactivate a technician, who then loses access", async () => {
    const admin = await signInAs(users.fairviewAdmin);
    const jennaId = await memberIdFor(users.jenna);
    const jenna = await signInAs(users.jenna);

    const { error } = await admin
      .from("organization_members")
      .update({ is_active: false })
      .eq("id", jennaId);
    expect(error).toBeNull();

    const { data } = await jenna.from("jobs").select("id");
    expect(data).toEqual([]);
  });

  it("a technician cannot edit members", async () => {
    const alex = await signInAs(users.alex);
    const { data, error } = await alex
      .from("organization_members")
      .update({ full_name: "Renamed" })
      .eq("id", await memberIdFor(users.alex))
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
