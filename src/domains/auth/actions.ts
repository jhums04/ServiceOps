"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentMember, homePathFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { demoRoleSchema, signInSchema } from "./schemas";

export type SignInState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

const demoCredentialsSchema = z.object({
  DEMO_ADMIN_EMAIL: z.email(),
  DEMO_ADMIN_PASSWORD: z.string().min(1),
  DEMO_TECHNICIAN_EMAIL: z.email(),
  DEMO_TECHNICIAN_PASSWORD: z.string().min(1),
});

async function signInAndRedirect(
  email: string,
  password: string,
): Promise<SignInState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Email or password is incorrect." };
  }

  const member = await getCurrentMember();
  if (!member) {
    await supabase.auth.signOut();
    return { error: "This account is not active. Contact your administrator." };
  }

  redirect(homePathFor(member.role));
}

export async function signIn(
  _state: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  return signInAndRedirect(parsed.data.email, parsed.data.password);
}

export async function signInAsDemo(
  _state: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const role = demoRoleSchema.parse(formData.get("role"));
  const env = demoCredentialsSchema.parse(process.env);
  const credentials =
    role === "admin"
      ? { email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD }
      : {
          email: env.DEMO_TECHNICIAN_EMAIL,
          password: env.DEMO_TECHNICIAN_PASSWORD,
        };
  return signInAndRedirect(credentials.email, credentials.password);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
