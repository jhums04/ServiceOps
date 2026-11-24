import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/domains/auth/components/login-form";
import { getCurrentMember, homePathFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in | ServiceOps" };

export default async function LoginPage() {
  const member = await getCurrentMember();
  if (member) redirect(homePathFor(member.role));

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">ServiceOps</h1>
        <p className="mt-1 mb-8 text-muted-foreground">
          Sign in to your workspace.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
