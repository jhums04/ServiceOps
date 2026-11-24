import Stripe from "stripe";

import { processStripeEvent } from "@/domains/payments/webhook";
import { getWebhookSecret } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  // The signature covers the exact bytes Stripe sent, so verify the raw body before
  // parsing anything.
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      payload,
      signature,
      getWebhookSecret(),
    );
  } catch {
    return Response.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  const outcome = await processStripeEvent(event);
  return Response.json({ received: true, outcome });
}
