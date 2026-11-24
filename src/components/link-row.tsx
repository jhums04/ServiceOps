"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";

/** A table row that navigates on click. Keep a real link in the row for keyboard users. */
export function LinkRow({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      {children}
    </TableRow>
  );
}
