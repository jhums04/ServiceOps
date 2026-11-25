import "server-only";

import Stripe from "stripe";
import { z } from "zod";

export function getStripe() {
  const secretKey = z
    .string()
    .startsWith("sk_test_", "Only Stripe test mode keys are allowed.")
    .parse(process.env.STRIPE_SECRET_KEY);
  return new Stripe(secretKey);
}

export function getWebhookSecret() {
  return z
    .string()
    .startsWith("whsec_")
    .parse(process.env.STRIPE_WEBHOOK_SECRET);
}
