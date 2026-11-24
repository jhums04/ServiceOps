"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

/**
 * Shown after Stripe redirects back. The redirect proves nothing about payment, so the
 * page keeps refreshing until the verified webhook has marked the invoice paid.
 */
export function PaymentProcessing() {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  const gaveUp = polls >= MAX_POLLS;

  useEffect(() => {
    if (gaveUp) return;
    const timer = setTimeout(() => {
      router.refresh();
      setPolls((count) => count + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [polls, gaveUp, router]);

  return (
    <div role="status" className="rounded-lg border p-4">
      <p className="font-medium">Payment processing</p>
      <p className="mt-1 text-muted-foreground">
        {gaveUp
          ? "This is taking longer than usual. Your payment is safe; refresh this page in a few minutes to see the confirmation."
          : "We are confirming your payment with Stripe. This page updates automatically."}
      </p>
    </div>
  );
}
