"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const NO_DATA_FOUND = "P0002";

function revalidateInvoices() {
  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  revalidatePath("/customers", "layout");
}

export type GenerateInvoiceResult = {
  invoice?: { id: string; number: number };
  error?: string;
};

export async function generateInvoice(
  jobId: string,
): Promise<GenerateInvoiceResult> {
  const id = z.uuid().safeParse(jobId);
  if (!id.success) return { error: "Invalid job." };

  await requireAdmin();
  const supabase = await createClient();
  const { data: invoiceId, error } = await supabase.rpc("create_invoice", {
    p_job_id: id.data,
  });

  if (error?.code === UNIQUE_VIOLATION) {
    return { error: "This job already has an invoice. Refresh to see it." };
  }
  if (error?.code === CHECK_VIOLATION) return { error: `${error.message}.` };
  if (error?.code === NO_DATA_FOUND)
    return { error: "This job no longer exists." };
  if (error) throw error;

  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select("id, number")
    .eq("id", invoiceId)
    .single();
  if (readError) throw readError;

  revalidateInvoices();
  return { invoice };
}

export async function voidInvoice(
  invoiceId: string,
): Promise<{ error?: string }> {
  const id = z.uuid().safeParse(invoiceId);
  if (!id.success) return { error: "Invalid invoice." };

  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", {
    p_invoice_id: id.data,
  });

  if (error?.code === CHECK_VIOLATION) {
    return {
      error:
        "Only unpaid invoices can be voided. Refresh to see its current status.",
    };
  }
  if (error?.code === NO_DATA_FOUND)
    return { error: "This invoice no longer exists." };
  if (error) throw error;

  revalidateInvoices();
  return {};
}
