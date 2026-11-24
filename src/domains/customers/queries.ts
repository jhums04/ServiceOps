import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toSearchTerm } from "@/lib/search-params";

import type { CustomerListParams } from "./schemas";

export const CUSTOMERS_PAGE_SIZE = 50;

// Views are typed with nullable columns; these are non-null in customer_summaries.
type CustomerSummary = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  outstanding_cents: number;
};

export async function listCustomers({
  q,
  outstanding,
  page,
}: CustomerListParams) {
  const supabase = await createClient();
  const from = (page - 1) * CUSTOMERS_PAGE_SIZE;

  let request = supabase
    .from("customer_summaries")
    .select("*", { count: "exact" })
    .order("name")
    .order("id")
    .range(from, from + CUSTOMERS_PAGE_SIZE - 1);

  const term = toSearchTerm(q);
  if (term) {
    request = request.or(
      `name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`,
    );
  }
  if (outstanding) request = request.gt("outstanding_cents", 0);

  const { data, error, count } = await request.overrideTypes<
    CustomerSummary[],
    { merge: false }
  >();
  if (error) throw error;
  return { customers: data, total: count ?? 0 };
}

export async function getCustomer(id: string) {
  const supabase = await createClient();

  const [customer, jobs, invoices] = await Promise.all([
    supabase
      .from("customer_summaries")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<CustomerSummary | null, { merge: false }>(),
    supabase
      .from("jobs")
      .select(
        "id, service, status, starts_at, ends_at, price_cents, technician:organization_members (full_name)",
      )
      .eq("customer_id", id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, number, amount_cents, status, issued_at, due_on, job:jobs!inner (customer_id)",
      )
      .eq("job.customer_id", id)
      .order("issued_at", { ascending: false }),
  ]);

  if (customer.error) throw customer.error;
  if (jobs.error) throw jobs.error;
  if (invoices.error) throw invoices.error;
  if (!customer.data) return null;

  return { customer: customer.data, jobs: jobs.data, invoices: invoices.data };
}

export async function listCustomerOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}
