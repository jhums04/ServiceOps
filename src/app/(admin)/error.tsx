"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/error-state";

export default function SegmentError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState retry={retry} />;
}
