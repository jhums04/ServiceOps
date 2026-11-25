import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { paymentFromEvent } from "@/domains/payments/stripe-event";

const INVOICE_ID = "6f9c1f3e-6b0a-4d47-9a39-6d7e2f8f1c11";

function event(type: string, object: Record<string, unknown>) {
  return Stripe.webhooks.constructEventWithoutVerification(
    JSON.stringify({ id: "evt_1", object: "event", type, data: { object } }),
  );
}

const session = {
  id: "cs_test_1",
  object: "checkout.session",
  payment_status: "paid",
  amount_total: 18900,
  currency: "usd",
  payment_intent: "pi_1",
  metadata: { invoice_id: INVOICE_ID },
};

describe("paymentFromEvent", () => {
  it("maps a completed Checkout Session", () => {
    expect(
      paymentFromEvent(event("checkout.session.completed", session)),
    ).toEqual({
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      invoiceId: INVOICE_ID,
      checkoutSessionId: "cs_test_1",
      paymentIntentId: "pi_1",
      paymentStatus: "paid",
      amountCents: 18900,
      currency: "usd",
    });
  });

  it("maps an asynchronous payment result", () => {
    expect(
      paymentFromEvent(event("checkout.session.async_payment_failed", session))
        ?.eventType,
    ).toBe("checkout.session.async_payment_failed");
  });

  it("ignores unrelated events", () => {
    expect(
      paymentFromEvent(event("checkout.session.expired", session)),
    ).toBeNull();
    expect(
      paymentFromEvent(
        event("payment_intent.succeeded", {
          id: "pi_1",
          object: "payment_intent",
        }),
      ),
    ).toBeNull();
  });

  it("treats a missing or malformed invoice id as absent", () => {
    for (const metadata of [{}, { invoice_id: "1; drop table invoices" }]) {
      expect(
        paymentFromEvent(
          event("checkout.session.completed", { ...session, metadata }),
        )?.invoiceId,
      ).toBeNull();
    }
  });
});
