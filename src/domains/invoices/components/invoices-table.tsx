"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { StatusDot } from "@/components/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCalendarDate, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import type { InvoiceRow } from "../queries";
import { invoiceDisplayStatus } from "../status";
import { InvoiceSheet } from "./invoice-sheet";

/** The open invoice lives in the URL (?invoice=id) so other pages can link to it. */
export function InvoicesTable({
  invoices,
  selected,
  timeZone,
  today,
}: {
  invoices: InvoiceRow[];
  selected: InvoiceRow | null;
  timeZone: string;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(invoiceId: string | null) {
    const params = new URLSearchParams(searchParams);
    if (invoiceId) params.set("invoice", invoiceId);
    else params.delete("invoice");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <>
      {invoices.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const status = invoiceDisplayStatus(
                invoice.status,
                invoice.due_on,
                today,
              );
              return (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => select(invoice.id)}
                >
                  <TableCell className="font-mono">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        select(invoice.id);
                      }}
                    >
                      {invoice.number}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.job.customer.name}
                  </TableCell>
                  <TableCell>{invoice.line_description}</TableCell>
                  <TableCell>
                    {formatDate(invoice.issued_at, timeZone)}
                  </TableCell>
                  <TableCell>
                    {formatCalendarDate(invoice.due_on, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={status.tone} label={status.label} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(invoice.amount_cents)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <InvoiceSheet
        invoice={selected}
        onOpenChange={(open) => {
          if (!open) select(null);
        }}
        timeZone={timeZone}
        today={today}
      />
    </>
  );
}
