"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import type { ActionState } from "@/lib/forms";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

// Repeat clicks within the same window return the same open Checkout Session, which
// keeps a customer from opening several sessions and paying the invoice twice.
const SESSION_WINDOW_SECONDS = 30 * 60;

export async function startCheckout(token: string): Promise<ActionState> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { error: "This payment link is not valid." };

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .rpc("get_public_invoice", { p_token: parsed.data })
    .maybeSingle();
  if (error) throw error;
  if (!invoice) return { error: "This payment link is not valid." };
  if (invoice.status === "paid")
    return { error: "This invoice is already paid." };
  if (invoice.status === "void")
    return { error: "This invoice was voided and cannot be paid." };

  const windowStart =
    Math.floor(Date.now() / 1000 / SESSION_WINDOW_SECONDS) *
    SESSION_WINDOW_SECONDS;
  const emailHash = createHash("sha256")
    .update(invoice.customer_email ?? "")
    .digest("hex")
    .slice(0, 16);
  const payUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/pay/${parsed.data}`;

  let checkoutUrl: string | null;
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: invoice.currency,
              unit_amount: invoice.amount_cents,
              product_data: {
                name: `Invoice ${invoice.number}: ${invoice.line_description}`,
              },
            },
          },
        ],
        customer_email: invoice.customer_email ?? undefined,
        metadata: { invoice_id: invoice.id },
        payment_intent_data: { metadata: { invoice_id: invoice.id } },
        // Stripe requires at least 30 minutes; this outlives every click in the window.
        expires_at: windowStart + 2 * SESSION_WINDOW_SECONDS,
        success_url: `${payUrl}?checkout=success`,
        cancel_url: payUrl,
      },
      { idempotencyKey: `checkout:${invoice.id}:${windowStart}:${emailHash}` },
    );
    checkoutUrl = session.url;
  } catch (stripeError) {
    if (!(stripeError instanceof Stripe.errors.StripeError)) throw stripeError;
    console.error("Stripe Checkout Session creation failed", stripeError);
    return {
      error: "Payments are unavailable right now. Try again in a few minutes.",
    };
  }

  if (!checkoutUrl)
    throw new Error("Stripe returned a Checkout Session without a URL.");
  redirect(checkoutUrl);
}
