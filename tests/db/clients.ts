import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export const PASSWORD = "local-demo-password";

export const users = {
  fairviewAdmin: "admin@fairview.example",
  alex: "alex.moreno@fairview.example",
  jenna: "jenna.kowalski@fairview.example",
  lakesideAdmin: "admin@lakeside.example",
  rosa: "rosa.delgado@lakeside.example",
} as const;

export const LAKESIDE_ID = "a0000000-0000-4000-8000-000000000002";
export const FAIRVIEW_ID = "a0000000-0000-4000-8000-000000000001";

export const TABLES = [
  "organizations",
  "organization_members",
  "customers",
  "jobs",
  "invoices",
  "payments",
  "stripe_webhook_events",
] as const;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    options,
  );
}

// Ground truth for assertions only. Bypasses RLS, so never use it as the actor under test.
export function serviceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    options,
  );
}

export async function signInAs(
  email: string,
): Promise<SupabaseClient<Database>> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

export async function memberIdFor(email: string): Promise<string> {
  const service = serviceClient();
  const { data: users, error: usersError } =
    await service.auth.admin.listUsers();
  if (usersError) throw usersError;
  const user = users.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`No auth user for ${email}`);

  const { data, error } = await service
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (error) throw error;
  return data.id;
}

/** Restores seeded data after tests that write. */
export async function resetDemoData() {
  const { error } = await serviceClient().rpc("reset_demo_data");
  if (error) throw error;
}
