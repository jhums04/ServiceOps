"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { startCheckout } from "../checkout";

export function PayButton({
  token,
  amount,
}: {
  token: string;
  amount: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="h-11 w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const result = await startCheckout(token);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "Opening secure checkout..." : `Pay ${amount}`}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
