import Link from "next/link";

import { StatusDot, type StatusTone } from "@/components/status-dot";
import { formatDate, formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import type { ActivityItem, ActivityKind } from "../queries";

const kindLabel: Record<ActivityKind, string> = {
  job_scheduled: "Job scheduled",
  job_completed: "Job completed",
  invoice_issued: "Invoice issued",
  payment_received: "Payment received",
};

const kindTone: Record<ActivityKind, StatusTone> = {
  job_scheduled: "gray",
  job_completed: "green",
  invoice_issued: "amber",
  payment_received: "green",
};

function detail(item: ActivityItem) {
  if (item.invoiceNumber !== null && item.amountCents !== null) {
    return `Invoice ${item.invoiceNumber}, ${formatMoney(item.amountCents)}`;
  }
  return item.service;
}

export function ActivityList({
  items,
  timeZone,
}: {
  items: ActivityItem[];
  timeZone: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li
          key={`${item.kind}:${item.invoiceId ?? item.jobId}`}
          className="flex items-start justify-between gap-4 py-2.5"
        >
          <div className="min-w-0">
            <StatusDot
              tone={kindTone[item.kind]}
              label={kindLabel[item.kind]}
            />
            <p className="truncate text-muted-foreground">
              {item.invoiceId ? (
                <Link
                  href={`/invoices?invoice=${item.invoiceId}`}
                  className="hover:text-foreground hover:underline"
                >
                  {detail(item)}
                </Link>
              ) : (
                detail(item)
              )}
              {" for "}
              {item.customerName}
            </p>
          </div>
          <time
            dateTime={item.occurredAt}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {formatDate(item.occurredAt, timeZone)},{" "}
            {formatTime(item.occurredAt, timeZone)}
          </time>
        </li>
      ))}
    </ul>
  );
}
