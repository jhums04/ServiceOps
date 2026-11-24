import Stripe from "stripe";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { FAIRVIEW_ID, resetDemoData, serviceClient } from "../db/clients";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const WEBHOOK_SECRET = "whsec_test_serviceops";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

const { POST } = await import("@/app/api/stripe/webhook/route");

const service = serviceClient();

type Invoice = { id: string; amount_cents: number };
let invoice: Invoice;
let eventCounter = 0;

function checkoutEvent(overrides: {
  type?: string;
  invoiceId?: string;
  paymentStatus?: string;
  amount?: number;
  currency?: string;
}) {
  eventCounter += 1;
  return JSON.stringify({
    id: `evt_test_${Date.now()}_${eventCounter}`,
    object: "event",
    type: overrides.type ?? "checkout.session.completed",
    data: {
      object: {
        id: `cs_test_${Date.now()}_${eventCounter}`,
        object: "checkout.session",
        payment_status: overrides.paymentStatus ?? "paid",
        amount_total: overrides.amount ?? invoice.amount_cents,
        currency: overrides.currency ?? "usd",
        payment_intent: `pi_test_${eventCounter}`,
        metadata: { invoice_id: overrides.invoiceId ?? invoice.id },
      },
    },
  });
}

function deliver(
  payload: string,
  secret = WEBHOOK_SECRET,
  signature?: string | null,
) {
  const header =
    signature === undefined
      ? Stripe.webhooks.generateTestHeaderString({ payload, secret })
      : signature;
  return POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: header === null ? {} : { "stripe-signature": header },
      body: payload,
    }),
  );
}

async function invoiceState() {
  const [{ data: row }, { count }] = await Promise.all([
    service
      .from("invoices")
      .select("status, paid_at")
      .eq("id", invoice.id)
      .single(),
    service
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice.id),
  ]);
  return { status: row?.status, paidAt: row?.paid_at, payments: count };
}

async function eventRecorded(payload: string) {
  const { id } = JSON.parse(payload) as { id: string };
  const { count } = await service
    .from("stripe_webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("id", id);
  return count === 1;
}

beforeAll(resetDemoData);
afterAll(resetDemoData);

beforeEach(async () => {
  // A fresh unpaid invoice per test keeps cases independent.
  const { data, error } = await service
    .from("invoices")
    .select("id, amount_cents")
    .eq("organization_id", FAIRVIEW_ID)
    .eq("status", "unpaid")
    .order("number")
    .limit(1)
    .single();
  if (error) throw error;
  invoice = data;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("Stripe webhook", () => {
  it("marks the invoice paid for a verified, matching payment", async () => {
    const response = await deliver(checkoutEvent({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "paid" });

    const state = await invoiceState();
    expect(state).toMatchObject({ status: "paid", payments: 1 });
    expect(state.paidAt).not.toBeNull();
  });

  it("records one payment when the same event is delivered twice", async () => {
    const payload = checkoutEvent({});
    const first = await deliver(payload);
    const second = await deliver(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      received: true,
      outcome: "duplicate_event",
    });
    expect(await invoiceState()).toMatchObject({ status: "paid", payments: 1 });
  });

  it("records one payment when the same event is delivered concurrently", async () => {
    const payload = checkoutEvent({});
    const responses = await Promise.all([
      deliver(payload),
      deliver(payload),
      deliver(payload),
    ]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await invoiceState()).toMatchObject({ status: "paid", payments: 1 });
  });

  it("does not pay the invoice twice for a second, different event", async () => {
    await deliver(checkoutEvent({}));
    const response = await deliver(checkoutEvent({}));
    expect(await response.json()).toEqual({
      received: true,
      outcome: "invoice_not_payable",
    });
    expect(await invoiceState()).toMatchObject({ status: "paid", payments: 1 });
  });

  it("rejects an unsigned request with 400 and changes nothing", async () => {
    const payload = checkoutEvent({});
    const response = await deliver(payload, WEBHOOK_SECRET, null);
    expect(response.status).toBe(400);
    expect(await invoiceState()).toMatchObject({
      status: "unpaid",
      payments: 0,
    });
    expect(await eventRecorded(payload)).toBe(false);
  });

  it("rejects a request signed with the wrong secret with 400 and changes nothing", async () => {
    const payload = checkoutEvent({});
    const response = await deliver(payload, "whsec_someone_else");
    expect(response.status).toBe(400);
    expect(await invoiceState()).toMatchObject({
      status: "unpaid",
      payments: 0,
    });
    expect(await eventRecorded(payload)).toBe(false);
  });

  it("rejects a payload altered after signing", async () => {
    const payload = checkoutEvent({ amount: 1 });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    const tampered = payload.replace(
      '"amount_total":1',
      `"amount_total":${invoice.amount_cents}`,
    );
    const response = await deliver(tampered, WEBHOOK_SECRET, signature);
    expect(response.status).toBe(400);
    expect(await invoiceState()).toMatchObject({
      status: "unpaid",
      payments: 0,
    });
  });

  it.each([
    ["an unpaid session", { paymentStatus: "unpaid" }, "not_paid"],
    [
      "a failed asynchronous payment",
      {
        type: "checkout.session.async_payment_failed",
        paymentStatus: "unpaid",
      },
      "not_paid",
    ],
    ["an amount mismatch", { amount: 1 }, "amount_mismatch"],
    ["a currency mismatch", { currency: "eur" }, "amount_mismatch"],
  ])(
    "leaves the invoice unpaid for %s and records the event",
    async (_, overrides, outcome) => {
      const payload = checkoutEvent(overrides);
      const response = await deliver(payload);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true, outcome });
      expect(await invoiceState()).toMatchObject({
        status: "unpaid",
        payments: 0,
      });
      expect(await eventRecorded(payload)).toBe(true);
    },
  );

  it("does not pay a void invoice", async () => {
    const { error } = await service
      .from("invoices")
      .update({ status: "void" })
      .eq("id", invoice.id);
    expect(error).toBeNull();

    const response = await deliver(checkoutEvent({}));
    expect(await response.json()).toEqual({
      received: true,
      outcome: "invoice_not_payable",
    });
    expect(await invoiceState()).toMatchObject({ status: "void", payments: 0 });
  });

  it("acknowledges events it does not handle without recording them", async () => {
    const payload = checkoutEvent({ type: "checkout.session.expired" });
    const response = await deliver(payload);
    expect(await response.json()).toEqual({
      received: true,
      outcome: "ignored",
    });
    expect(await eventRecorded(payload)).toBe(false);
  });
});
