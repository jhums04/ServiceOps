import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/pagination";
import { InvoiceFilters } from "@/domains/invoices/components/invoice-filters";
import { InvoicesTable } from "@/domains/invoices/components/invoices-table";
import {
  getInvoice,
  INVOICES_PAGE_SIZE,
  listInvoices,
} from "@/domains/invoices/queries";
import { invoiceListParamsSchema } from "@/domains/invoices/schemas";
import { requireAdmin } from "@/lib/auth";
import { todayInZone } from "@/lib/dates";
import { toQueryString } from "@/lib/search-params";

export const metadata: Metadata = { title: "Invoices | ServiceOps" };

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/invoices">) {
  const params = invoiceListParamsSchema.parse(await searchParams);
  const member = await requireAdmin();
  const timeZone = member.organization.time_zone;
  const today = todayInZone(timeZone);

  const { invoices, total } = await listInvoices(params, today);
  const selected = params.invoice
    ? (invoices.find((invoice) => invoice.id === params.invoice) ??
      (await getInvoice(params.invoice)))
    : null;

  return (
    <>
      <PageHeader title="Invoices" />
      <InvoiceFilters status={params.status} />
      {invoices.length === 0 &&
        (params.status ? (
          <EmptyState message="No invoices match this filter." />
        ) : (
          <EmptyState message="No invoices yet. Generate one from a completed job." />
        ))}
      <InvoicesTable
        invoices={invoices}
        selected={selected}
        timeZone={timeZone}
        today={today}
      />
      <Pagination
        page={params.page}
        pageSize={INVOICES_PAGE_SIZE}
        total={total}
        hrefForPage={(page) =>
          `/invoices${toQueryString({ status: params.status, page })}`
        }
      />
    </>
  );
}
