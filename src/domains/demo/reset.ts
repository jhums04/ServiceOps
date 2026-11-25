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
 * Restores the demo auth users, then regenerates all demo business data.
 *
 * A visitor signed in as a demo account can change its password through the Auth API,
 * which would lock everyone else out; the two public demo logins get their passwords
 * set back on every reset. Email changes need confirmation from the old, fictional
 * address, so they cannot complete. The other accounts never sign in on the hosted
 * demo: they are created with a random password if missing and otherwise left alone.
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
  const existing = new Map(data.users.map((user) => [user.email, user.id]));

  for (const email of DEMO_EMAILS) {
    const userId = existing.get(email);
    const password = loginPasswords.get(email);
    if (userId && password) {
      const { error: updateError } = await service.auth.admin.updateUserById(
        userId,
        { password, email_confirm: true },
      );
      if (updateError) throw updateError;
    } else if (!userId) {
      const { error: createError } = await service.auth.admin.createUser({
        email,
        password: password ?? randomBytes(32).toString("hex"),
        email_confirm: true,
      });
      if (createError) throw createError;
    }
  }

  const { error: resetError } = await service.rpc("reset_demo_data");
  if (resetError) throw resetError;
}
