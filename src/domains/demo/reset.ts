import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";

// Must match the members created by public.reset_demo_data().
const DEMO_EMAILS = [
  "admin@fairview.example",
  "alex.moreno@fairview.example",
  "jenna.kowalski@fairview.example",
  "priya.shah@fairview.example",
  "tom.alvarez@fairview.example",
  "admin@lakeside.example",
  "rosa.delgado@lakeside.example",
] as const;

const resetEnvSchema = z.object({
  DEMO_RESET_SECRET: z.string().min(16),
  DEMO_ADMIN_EMAIL: z.enum(DEMO_EMAILS),
  DEMO_ADMIN_PASSWORD: z.string().min(12),
  DEMO_TECHNICIAN_EMAIL: z.enum(DEMO_EMAILS),
  DEMO_TECHNICIAN_PASSWORD: z.string().min(12),
});

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Constant-time check of an `Authorization: Bearer <secret>` header. */
export function isAuthorizedReset(header: string | null) {
  const { DEMO_RESET_SECRET } = resetEnvSchema
    .pick({ DEMO_RESET_SECRET: true })
    .parse(process.env);
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  // Hashing first gives equal-length buffers, so the comparison leaks nothing about length.
  return timingSafeEqual(digest(token), digest(DEMO_RESET_SECRET));
}

/**
 * Ensures the demo auth users exist, then regenerates all demo business data.
 *
 * Visitors cannot change demo credentials: a trigger on auth.users rejects it. The two
 * public demo logins still have their passwords set from the environment here, through
 * a service-role-only function, so rotating a password only takes an environment
 * change. The other accounts never sign in on the hosted demo; they are created with
 * a random password if missing.
 */
export async function resetDemo() {
  const env = resetEnvSchema.parse(process.env);
  const service = createServiceClient();
  const loginPasswords = new Map<string, string>([
    [env.DEMO_ADMIN_EMAIL, env.DEMO_ADMIN_PASSWORD],
    [env.DEMO_TECHNICIAN_EMAIL, env.DEMO_TECHNICIAN_PASSWORD],
  ]);

  const { data, error } = await service.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw error;
  const existing = new Set(data.users.map((user) => user.email));

  for (const email of DEMO_EMAILS) {
    const password = loginPasswords.get(email);
    if (!existing.has(email)) {
      const { error: createError } = await service.auth.admin.createUser({
        email,
        password: password ?? randomBytes(32).toString("hex"),
        email_confirm: true,
      });
      if (createError) throw createError;
    } else if (password) {
      const { error: passwordError } = await service.rpc("set_demo_password", {
        p_email: email,
        p_password: password,
      });
      if (passwordError) throw passwordError;
    }
  }

  const { error: resetError } = await service.rpc("reset_demo_data");
  if (resetError) throw resetError;
}
