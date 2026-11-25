import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  anonClient,
  FAIRVIEW_ID,
  resetDemoData,
  serviceClient,
  signInAs,
  users,
} from "./clients";

const service = serviceClient();
let admin: SupabaseClient<Database>;

/** Completed Fairview jobs that have no active invoice yet. */
async function uninvoicedCompletedJobs() {
  const { data, error } = await service
    .from("jobs")
    .select("id, price_cents, invoices (status)")
    .eq("organization_id", FAIRVIEW_ID)
    .eq("status", "completed");
  if (error) throw error;
  return data
    .filter((job) => job.invoices.every((invoice) => invoice.status === "void"))
    .map((job) => job.id);
}

async function activeInvoicesFor(jobId: string) {
  const { data } = await service
    .from("invoices")
    .select("id, number, amount_cents, status")
    .eq("job_id", jobId)
    .neq("status", "void");
  return data ?? [];
}

beforeAll(async () => {
  await resetDemoData();
  admin = await signInAs(users.fairviewAdmin);
});

afterAll(resetDemoData);

describe("create_invoice", () => {
  it("issues the next sequential number with the job's amount and a 14-day due date", async () => {
    const [jobId = ""] = await uninvoicedCompletedJobs();
    const { data: organization } = await service
      .from("organizations")
      .select("next_invoice_number")
      .eq("id", FAIRVIEW_ID)
      .single();
    const { data: job } = await service
      .from("jobs")
      .select("service, price_cents")
      .eq("id", jobId)
      .single();

    const { data: invoiceId, error } = await admin.rpc("create_invoice", {
      p_job_id: jobId,
    });
    expect(error).toBeNull();

    const { data: invoice } = await service
      .from("invoices")
      .select(
        "number, amount_cents, line_description, status, issued_at, due_on, public_token",
      )
      .eq("id", invoiceId ?? "")
      .single();
    expect(invoice?.number).toBe(organization?.next_invoice_number);
    expect(invoice?.amount_cents).toBe(job?.price_cents);
    expect(invoice?.line_description).toBe(job?.service);
    expect(invoice?.status).toBe("unpaid");
    expect(invoice?.public_token).toMatch(/^[0-9a-f]{64}$/);
    const days =
      (new Date(`${invoice?.due_on}T00:00:00Z`).getTime() -
        new Date(`${invoice?.issued_at.slice(0, 10)}T00:00:00Z`).getTime()) /
      86_400_000;
    expect(days).toBeGreaterThanOrEqual(13);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("refuses a second invoice for the same job", async () => {
    const [, jobId = ""] = await uninvoicedCompletedJobs();
    expect(
      (await admin.rpc("create_invoice", { p_job_id: jobId })).error,
    ).toBeNull();

    const second = await admin.rpc("create_invoice", { p_job_id: jobId });
    expect(second.error?.code).toBe("23505");
    expect(await activeInvoicesFor(jobId)).toHaveLength(1);
  });

  it("yields exactly one invoice when generated twice concurrently", async () => {
    const [, , jobId = ""] = await uninvoicedCompletedJobs();
    const secondAdmin = await signInAs(users.fairviewAdmin);

    const results = await Promise.all([
      admin.rpc("create_invoice", { p_job_id: jobId }),
      secondAdmin.rpc("create_invoice", { p_job_id: jobId }),
    ]);

    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expect(results.find((result) => result.error)?.error?.code).toBe("23505");
    expect(await activeInvoicesFor(jobId)).toHaveLength(1);
  });

  it("does not consume an invoice number when generation fails", async () => {
    const before = await service
      .from("organizations")
      .select("next_invoice_number")
      .eq("id", FAIRVIEW_ID)
      .single();
    const { data: scheduled } = await service
      .from("jobs")
      .select("id")
      .eq("organization_id", FAIRVIEW_ID)
      .eq("status", "scheduled")
      .limit(1)
      .single();

    const { error } = await admin.rpc("create_invoice", {
      p_job_id: scheduled?.id ?? "",
    });
    expect(error?.code).toBe("23514");
    expect(error?.message).toBe("Only completed jobs can be invoiced");

    const after = await service
      .from("organizations")
      .select("next_invoice_number")
      .eq("id", FAIRVIEW_ID)
      .single();
    expect(after.data?.next_invoice_number).toBe(
      before.data?.next_invoice_number,
    );
  });

  it("is refused to technicians", async () => {
    const [jobId = ""] = await uninvoicedCompletedJobs();
    const alex = await signInAs(users.alex);
    const { error } = await alex.rpc("create_invoice", { p_job_id: jobId });
    expect(error?.code).toBe("42501");
  });

  it("cannot invoice another organization's job", async () => {
    const { data: lakesideJob } = await service
      .from("jobs")
      .select("id")
      .neq("organization_id", FAIRVIEW_ID)
      .eq("status", "completed")
      .limit(1)
      .single();
    const { error } = await admin.rpc("create_invoice", {
      p_job_id: lakesideJob?.id ?? "",
    });
    expect(error?.code).toBe("P0002");
  });
});

describe("invoice immutability", () => {
  it("keeps the invoiced amount when the job's price changes", async () => {
    const [jobId = ""] = await uninvoicedCompletedJobs();
    const { data: invoiceId } = await admin.rpc("create_invoice", {
      p_job_id: jobId,
    });
    const [invoice] = await activeInvoicesFor(jobId);

    const { error } = await admin
      .from("jobs")
      .update({ price_cents: 1 })
      .eq("id", jobId);
    expect(error).toBeNull();

    const { data: after } = await service
      .from("invoices")
      .select("amount_cents")
      .eq("id", invoiceId ?? "")
      .single();
    expect(after?.amount_cents).toBe(invoice?.amount_cents);
    expect(after?.amount_cents).not.toBe(1);
  });

  it("rejects direct updates to the amount, even for the service role", async () => {
    const { data: invoice } = await service
      .from("invoices")
      .select("id")
      .eq("organization_id", FAIRVIEW_ID)
      .limit(1)
      .single();

    const asAdmin = await admin
      .from("invoices")
      .update({ amount_cents: 1 })
      .eq("id", invoice?.id ?? "");
    expect(asAdmin.error?.code).toBe("42501");

    const asService = await service
      .from("invoices")
      .update({ amount_cents: 1 })
      .eq("id", invoice?.id ?? "");
    expect(asService.error?.code).toBe("23514");
  });
});

describe("void_invoice", () => {
  it("voids an unpaid invoice and allows a new one for the same job", async () => {
    const [jobId = ""] = await uninvoicedCompletedJobs();
    const { data: firstId } = await admin.rpc("create_invoice", {
      p_job_id: jobId,
    });

    expect(
      (await admin.rpc("void_invoice", { p_invoice_id: firstId ?? "" })).error,
    ).toBeNull();
    const { data: voided } = await service
      .from("invoices")
      .select("status, voided_at")
      .eq("id", firstId ?? "")
      .single();
    expect(voided?.status).toBe("void");
    expect(voided?.voided_at).not.toBeNull();

    const replacement = await admin.rpc("create_invoice", { p_job_id: jobId });
    expect(replacement.error).toBeNull();
    expect(await activeInvoicesFor(jobId)).toHaveLength(1);
  });

  it("refuses to void a paid invoice", async () => {
    const { data: paid } = await service
      .from("invoices")
      .select("id")
      .eq("organization_id", FAIRVIEW_ID)
      .eq("status", "paid")
      .limit(1)
      .single();
    const { error } = await admin.rpc("void_invoice", {
      p_invoice_id: paid?.id ?? "",
    });
    expect(error?.code).toBe("23514");
  });
});

describe("get_public_invoice", () => {
  it("returns the invoice for its token to anonymous visitors", async () => {
    const { data: invoice } = await service
      .from("invoices")
      .select("id, number, amount_cents, public_token")
      .eq("organization_id", FAIRVIEW_ID)
      .eq("status", "unpaid")
      .limit(1)
      .single();

    const { data, error } = await anonClient().rpc("get_public_invoice", {
      p_token: invoice?.public_token ?? "",
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      id: invoice?.id,
      number: invoice?.number,
      amount_cents: invoice?.amount_cents,
      organization_name: "Fairview Plumbing & Heating",
    });
  });

  it("returns nothing for unknown or malformed tokens", async () => {
    const anon = anonClient();
    for (const token of ["0".repeat(64), "not-a-token", "", "%"]) {
      const { data, error } = await anon.rpc("get_public_invoice", {
        p_token: token,
      });
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it("is the only way for anonymous visitors to read invoices", async () => {
    const { error } = await anonClient().from("invoices").select("id").limit(1);
    expect(error?.code).toBe("42501");
  });
});

describe("record_stripe_payment", () => {
  it("is callable only by the service role", async () => {
    const args = {
      p_event_id: "evt_not_allowed",
      p_event_type: "checkout.session.completed",
      p_invoice_id: "00000000-0000-0000-0000-000000000000",
      p_checkout_session_id: "cs_not_allowed",
      p_payment_status: "paid",
    };
    expect((await admin.rpc("record_stripe_payment", args)).error?.code).toBe(
      "42501",
    );
    expect(
      (await anonClient().rpc("record_stripe_payment", args)).error?.code,
    ).toBe("42501");
  });
});
