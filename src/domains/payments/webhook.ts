import "server-only";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { createServiceClient } from "@/lib/supabase/service";

import { paymentFromEvent } from "./stripe-event";

/**
 * Records a verified event. The database function makes this idempotent and decides
 * whether the invoice is paid; anything other than a clean payment is logged for
 * follow-up, because the customer may have been charged.
 */
export async function processStripeEvent(event: Stripe.Event) {
  const payment = paymentFromEvent(event);
  if (!payment) return "ignored";

  if (!payment.invoiceId) {
    console.error(
      `Stripe event ${event.id} has no valid invoice_id in its metadata.`,
    );
    return "missing_invoice";
  }

  const { data: outcome, error } = await createServiceClient().rpc(
    "record_stripe_payment",
    {
      p_event_id: payment.eventId,
      p_event_type: payment.eventType,
      p_invoice_id: payment.invoiceId,
      p_checkout_session_id: payment.checkoutSessionId,
      p_payment_status: payment.paymentStatus,
      p_amount_cents: payment.amountCents ?? undefined,
      p_currency: payment.currency ?? undefined,
      p_payment_intent_id: payment.paymentIntentId ?? undefined,
    },
  );
  if (error) throw error;

  if (outcome === "paid") {
    revalidatePath("/invoices");
    revalidatePath("/customers", "layout");
    revalidatePath("/dashboard");
  } else if (outcome !== "duplicate_event" && outcome !== "not_paid") {
    console.error(
      `Stripe event ${event.id} for invoice ${payment.invoiceId} was not applied: ${outcome}. Session ${payment.checkoutSessionId} may need a manual refund.`,
    );
  }
  return outcome;
}
