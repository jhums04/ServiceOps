"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { validationError, type ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { memberActiveSchema, memberSchema } from "./schemas";

export async function updateMember(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  await requireAdmin();
  const supabase = await createClient();
  const { id, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("organization_members")
    .update(fields)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (data.length === 0) return { error: "This employee no longer exists." };

  revalidatePath("/employees");
  return { ok: true };
}

export async function setMemberActive(input: {
  id: string;
  is_active: boolean;
}): Promise<ActionState> {
  const parsed = memberActiveSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const member = await requireAdmin();
  if (parsed.data.id === member.id && !parsed.data.is_active) {
    return { error: "You cannot deactivate your own account." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) throw error;
  if (data.length === 0) return { error: "This employee no longer exists." };

  revalidatePath("/employees");
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  return { ok: true };
}
