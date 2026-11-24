import type { ReactNode } from "react";

import type { Member } from "@/lib/auth";

import { MemberSummary } from "./member-summary";

export function TechnicianShell({
  member,
  children,
}: {
  member: Member;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto max-w-2xl px-4 py-2">
          <MemberSummary member={member} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
