import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

import type { Database } from "../src/lib/supabase/database.types";

process.loadEnvFile(".env.local");

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Ground truth for assertions only; bypasses RLS. */
export function serviceClient() {
  return createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function signInAsDemo(
  page: Page,
  role: "administrator" | "technician",
) {
  await page.goto("/login");
  await page.getByRole("button", { name: `Explore as ${role}` }).click();
  await expect(page).toHaveURL(
    role === "administrator" ? "/dashboard" : "/tech",
  );
}
