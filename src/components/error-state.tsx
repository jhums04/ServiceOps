"use client";

import { Button } from "@/components/ui/button";

export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
    >
      <p className="font-medium">This page could not be loaded.</p>
      <p className="text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
