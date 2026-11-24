"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { InvoiceListParams } from "../schemas";

const ALL = "all";
const labels = {
  unpaid: "Unpaid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
} as const;

export function InvoiceFilters({
  status,
}: {
  status: InvoiceListParams["status"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  return (
    <div className="mb-4">
      <Select
        value={status ?? ALL}
        onValueChange={(value) =>
          startTransition(() =>
            router.replace(
              value === ALL ? pathname : `${pathname}?status=${value}`,
            ),
          )
        }
      >
        <SelectTrigger aria-label="Status" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All invoices</SelectItem>
          {Object.entries(labels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
