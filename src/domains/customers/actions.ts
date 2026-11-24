"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { validationError, type ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { customerSchema } from "./schemas";

export async function saveCustomer(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const member = await requireAdmin();
  const supabase = await createClient();
  const { id, ...fields } = parsed.data;

  if (id) {
    const { data, error } = await supabase
      .from("customers")
      .update(fields)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (data.length === 0) return { error: "This customer no longer exists." };
    revalidatePath(`/customers/${id}`);
  } else {
    const { error } = await supabase
      .from("customers")
      .insert({ ...fields, organization_id: member.organization_id });
    if (error) throw error;
  }

  revalidatePath("/customers");
  return { ok: true };
}
