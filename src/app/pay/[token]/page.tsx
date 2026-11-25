import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/domains/customers/format";
import { getPublicInvoice } from "@/domains/invoices/queries";
import { invoiceDisplayStatus } from "@/domains/invoices/status";
import { PayButton } from "@/domains/payments/components/pay-button";
import { PaymentProcessing } from "@/domains/payments/components/payment-processing";
import { formatCalendarDate, formatDate, todayInZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Invoice | ServiceOps",
  robots: { index: false, follow: false },
  // The token in the URL is the only credential; never send it to other sites.
  referrer: "no-referrer",
};

const paramsSchema = z.object({ checkout: z.unknown().optional() });

export default async function PayPage({
  params,
  searchParams,
}: PageProps<"/pay/[token]">) {
  const { token } = await params;
  const { checkout } = paramsSchema.parse(await searchParams);
  const invoice = await getPublicInvoice(token);
  if (!invoice) notFound();

  const timeZone = invoice.organization_time_zone;
  const status = invoiceDisplayStatus(
    invoice.status,
    invoice.due_on,
    todayInZone(timeZone),
  );
  const amount = formatMoney(invoice.amount_cents);
  const address = formatAddress({
    street: invoice.customer_street,
    city: invoice.customer_city,
    state: invoice.customer_state,
    postal_code: invoice.customer_postal_code,
  });

  return (
    <main className="mx-auto min-h-svh max-w-lg px-4 py-10">
      <p className="text-base font-semibold">{invoice.organization_name}</p>
      <div className="mt-8 rounded-xl border">
        <div className="border-b p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-semibold">
              Invoice <span className="font-mono">{invoice.number}</span>
            </h1>
            <StatusDot tone={status.tone} label={status.label} />
          </div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{amount}</p>
        </div>

        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Service</dt>
            <dd>{invoice.line_description}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Billed to</dt>
            <dd>{invoice.customer_name}</dd>
            {address && <dd className="text-muted-foreground">{address}</dd>}
          </div>
          <div>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{formatDate(invoice.issued_at, timeZone)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Due</dt>
            <dd>
              {formatCalendarDate(invoice.due_on, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>

        <div className="space-y-3 border-t p-5">
          {invoice.status === "paid" && invoice.paid_at && (
            <div role="status" className="rounded-lg border p-4">
              <p className="font-medium">
                Paid on {formatDate(invoice.paid_at, timeZone)}
              </p>
              <p className="mt-1 text-muted-foreground">
                Thank you. No further action is needed.
              </p>
            </div>
          )}
          {invoice.status === "void" && (
            <div role="status" className="rounded-lg border p-4">
              <p className="font-medium">This invoice was voided</p>
              <p className="mt-1 text-muted-foreground">
                No payment is due. Contact {invoice.organization_name} if you
                have questions.
              </p>
            </div>
          )}
          {invoice.status === "unpaid" &&
            (checkout === "success" ? (
              <PaymentProcessing />
            ) : (
              <PayButton token={token} amount={amount} />
            ))}
          <Button variant="outline" className="w-full" asChild>
            <a href={`/pay/${token}/pdf`} target="_blank" rel="noopener">
              <Download aria-hidden />
              Download PDF
            </a>
          </Button>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Payments are processed securely by Stripe. Test mode: no real charges
        are made.
      </p>
    </main>
  );
}
