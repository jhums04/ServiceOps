import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerSheet } from "@/domains/customers/components/customer-sheet";
import { formatAddress } from "@/domains/customers/format";
import { getCustomer } from "@/domains/customers/queries";
import { invoiceDisplayStatus } from "@/domains/invoices/status";
import { jobStatusLabel, jobStatusTone } from "@/domains/jobs/status";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatTimeRange, todayInZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customer | ServiceOps" };

export default async function CustomerPage({
  params,
}: PageProps<"/customers/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [member, result] = await Promise.all([requireAdmin(), getCustomer(id)]);
  if (!result) notFound();

  const { customer, jobs, invoices } = result;
  const timeZone = member.organization.time_zone;
  const today = todayInZone(timeZone);
  const address = formatAddress(customer);

  return (
    <>
      <PageHeader
        title={customer.name}
        actions={
          <CustomerSheet
            customer={customer}
            trigger={
              <Button variant="outline">
                <Pencil aria-hidden />
                Edit
              </Button>
            }
          />
        }
      />

      <dl className="mb-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{customer.email ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{customer.phone ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Address</dt>
          <dd>{address || "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Outstanding balance</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(customer.outstanding_cents)}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="jobs-heading" className="mb-8">
        <h2 id="jobs-heading" className="mb-2 text-base font-semibold">
          Jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground">No jobs yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{formatDate(job.starts_at, timeZone)}</TableCell>
                  <TableCell>
                    {formatTimeRange(job.starts_at, job.ends_at, timeZone)}
                  </TableCell>
                  <TableCell>{job.service}</TableCell>
                  <TableCell>
                    {job.technician?.full_name ?? "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <StatusDot
                      tone={jobStatusTone[job.status]}
                      label={jobStatusLabel[job.status]}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(job.price_cents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="invoices-heading">
        <h2 id="invoices-heading" className="mb-2 text-base font-semibold">
          Invoices
        </h2>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground">No invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
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
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">
                      <Link
                        href={`/invoices?invoice=${invoice.id}`}
                        className="hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.issued_at, timeZone)}
                    </TableCell>
                    <TableCell>{invoice.due_on}</TableCell>
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
      </section>
    </>
  );
}
