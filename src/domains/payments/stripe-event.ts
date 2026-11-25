import type Stripe from "stripe";
import { z } from "zod";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

export type StripePayment = {
  eventId: string;
  eventType: string;
  invoiceId: string | null;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  paymentStatus: string;
  amountCents: number | null;
  currency: string | null;
};

/** Extracts the payment facts from a verified Checkout event, or null for other events. */
export function paymentFromEvent(event: Stripe.Event): StripePayment | null {
  if (
    !HANDLED_EVENTS.has(event.type) ||
    event.data.object.object !== "checkout.session"
  ) {
    return null;
  }
  const session = event.data.object;
  const invoiceId = z.uuid().safeParse(session.metadata?.invoice_id);
  const paymentIntent = session.payment_intent;

  return {
    eventId: event.id,
    eventType: event.type,
    invoiceId: invoiceId.success ? invoiceId.data : null,
    checkoutSessionId: session.id,
    paymentIntentId:
      typeof paymentIntent === "string"
        ? paymentIntent
        : (paymentIntent?.id ?? null),
    paymentStatus: session.payment_status,
    amountCents: session.amount_total,
    currency: session.currency,
  };
}
