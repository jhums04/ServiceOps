import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { InvoicePdfData } from "./invoice-pdf";
import type { InvoiceListParams } from "./schemas";

export const INVOICES_PAGE_SIZE = 50;

const INVOICE_COLUMNS =
  "id, number, status, line_description, amount_cents, issued_at, due_on, paid_at, voided_at, public_token, job:jobs (id, customer:customers (id, name)), payments (paid_at, stripe_checkout_session_id)";

export async function listInvoices(params: InvoiceListParams, today: string) {
  const supabase = await createClient();
  const from = (params.page - 1) * INVOICES_PAGE_SIZE;

  let request = supabase
    .from("invoices")
    .select(INVOICE_COLUMNS, { count: "exact" })
    .order("number", { ascending: false })
    .range(from, from + INVOICES_PAGE_SIZE - 1);

  if (params.status === "overdue")
    request = request.eq("status", "unpaid").lt("due_on", today);
  else if (params.status) request = request.eq("status", params.status);

  const { data, error, count } = await request;
  if (error) throw error;
  return { invoices: data, total: count ?? 0 };
}

export type InvoiceRow = Awaited<
  ReturnType<typeof listInvoices>
>["invoices"][number];

/** An invoice requested by id that is not on the current page, so its sheet can open. */
export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getInvoicePdfData(
  id: string,
  organization: { name: string; time_zone: string },
): Promise<InvoicePdfData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "number, status, line_description, amount_cents, issued_at, due_on, paid_at, job:jobs (customer:customers (name, email, street, city, state, postal_code))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { customer } = data.job;
  return {
    number: data.number,
    status: data.status,
    lineDescription: data.line_description,
    amountCents: data.amount_cents,
    issuedAt: data.issued_at,
    dueOn: data.due_on,
    paidAt: data.paid_at,
    organizationName: organization.name,
    timeZone: organization.time_zone,
    customer: {
      name: customer.name,
      email: customer.email,
      street: customer.street,
      city: customer.city,
      state: customer.state,
      postalCode: customer.postal_code,
    },
  };
}

/** The public invoice behind a payment link, readable without signing in. */
export async function getPublicInvoice(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_public_invoice", { p_token: token })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type PublicInvoice = NonNullable<
  Awaited<ReturnType<typeof getPublicInvoice>>
>;

export function publicInvoicePdfData(invoice: PublicInvoice): InvoicePdfData {
  return {
    number: invoice.number,
    status: invoice.status,
    lineDescription: invoice.line_description,
    amountCents: invoice.amount_cents,
    issuedAt: invoice.issued_at,
    dueOn: invoice.due_on,
    paidAt: invoice.paid_at,
    organizationName: invoice.organization_name,
    timeZone: invoice.organization_time_zone,
    customer: {
      name: invoice.customer_name,
      email: invoice.customer_email,
      street: invoice.customer_street,
      city: invoice.customer_city,
      state: invoice.customer_state,
      postalCode: invoice.customer_postal_code,
    },
  };
}
