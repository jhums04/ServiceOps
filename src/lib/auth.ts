import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

export const getCurrentMember = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, organization_id, role, full_name, organization:organizations (name, time_zone)",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
});

export async function getMember() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
}

export async function requireAdmin() {
  const member = await getMember();
  if (member.role !== "admin") redirect(homePathFor(member.role));
  return member;
}

export function homePathFor(role: Member["role"]) {
  return role === "admin" ? "/dashboard" : "/tech";
}
