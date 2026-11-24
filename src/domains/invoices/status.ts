import type { StatusTone } from "@/components/status-dot";
import type { Database } from "@/lib/supabase/database.types";

type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

/** Overdue is derived from the due date in the organization's time zone, never stored. */
export function invoiceDisplayStatus(
  status: InvoiceStatus,
  dueOn: string,
  today: string,
): { label: string; tone: StatusTone } {
  if (status === "paid") return { label: "Paid", tone: "green" };
  if (status === "void") return { label: "Void", tone: "gray" };
  return dueOn < today
    ? { label: "Overdue", tone: "red" }
    : { label: "Unpaid", tone: "amber" };
}
