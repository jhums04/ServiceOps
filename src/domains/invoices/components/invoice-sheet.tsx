"use client";

import { Copy, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCalendarDate, formatDate } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";

import { voidInvoice } from "../actions";
import type { InvoiceRow } from "../queries";
import { invoiceDisplayStatus } from "../status";

export function InvoiceSheet({
  invoice,
  onOpenChange,
  timeZone,
  today,
}: {
  invoice: InvoiceRow | null;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  today: string;
}) {
  return (
    <Sheet open={invoice !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {invoice && (
          <InvoiceDetails
            invoice={invoice}
            timeZone={timeZone}
            today={today}
            onVoided={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function InvoiceDetails({
  invoice,
  timeZone,
  today,
  onVoided,
}: {
  invoice: InvoiceRow;
  timeZone: string;
  today: string;
  onVoided: () => void;
}) {
  const status = invoiceDisplayStatus(invoice.status, invoice.due_on, today);
  const paymentUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/pay/${invoice.public_token}`;
  // payments.invoice_id is unique, so there is at most one.
  const [payment] = invoice.payments;

  async function copyPaymentLink() {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      toast.success("Payment link copied");
    } catch {
      toast.error(
        "Could not copy the link. Open the payment page and copy it from there.",
      );
    }
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>
          Invoice <span className="font-mono">{invoice.number}</span>
        </SheetTitle>
        <SheetDescription asChild>
          <div className="flex items-center gap-3">
            <StatusDot tone={status.tone} label={status.label} />
            <span>{invoice.job.customer.name}</span>
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(invoice.amount_cents)}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2">
            <dt className="text-muted-foreground">Description</dt>
            <dd>{invoice.line_description}</dd>
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
          {payment && (
            <>
              <div>
                <dt className="text-muted-foreground">Paid</dt>
                <dd>{formatDate(payment.paid_at, timeZone)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">
                  Stripe Checkout Session
                </dt>
                <dd className="font-mono text-xs break-all">
                  {payment.stripe_checkout_session_id}
                </dd>
              </div>
            </>
          )}
          {invoice.voided_at && (
            <div>
              <dt className="text-muted-foreground">Voided</dt>
              <dd>{formatDate(invoice.voided_at, timeZone)}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">Customer</dt>
            <dd>
              <Link
                href={`/customers/${invoice.job.customer.id}`}
                className="hover:underline"
              >
                {invoice.job.customer.name}
              </Link>
            </dd>
          </div>
        </dl>

        <div className="grid gap-2">
          <Button variant="outline" asChild>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener"
            >
              <Download aria-hidden />
              Download PDF
            </a>
          </Button>
          {invoice.status === "unpaid" && (
            <>
              <Button variant="outline" onClick={copyPaymentLink}>
                <Copy aria-hidden />
                Copy payment link
              </Button>
              <Button variant="outline" asChild>
                <a href={paymentUrl} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden />
                  Open payment page
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      {invoice.status === "unpaid" && (
        <SheetFooter className="border-t">
          <VoidInvoiceButton invoice={invoice} onVoided={onVoided} />
        </SheetFooter>
      )}
    </>
  );
}

function VoidInvoiceButton({
  invoice,
  onVoided,
}: {
  invoice: InvoiceRow;
  onVoided: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive" disabled={pending}>
          Void invoice
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void invoice {invoice.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its payment link will stop accepting payments, and you can generate
            a new invoice for the job. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep invoice</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const result = await voidInvoice(invoice.id);
                if (result.error) {
                  toast.error(result.error);
                } else {
                  toast.success(`Invoice ${invoice.number} voided`);
                  onVoided();
                }
              })
            }
          >
            Void invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
