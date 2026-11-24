import type { ReactNode } from "react";

import type { Member } from "@/lib/auth";

import { MemberSummary } from "./member-summary";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({
  member,
  children,
}: {
  member: Member;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <p className="px-2.5 pt-1 pb-4 text-base font-semibold">ServiceOps</p>
        <SidebarNav />
        <div className="mt-auto border-t border-sidebar-border pt-3">
          <MemberSummary member={member} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-background px-2 lg:hidden">
        <MobileNav footer={<MemberSummary member={member} />} />
        <span className="font-semibold">ServiceOps</span>
      </header>

      <main className="px-4 py-6 lg:ml-56 lg:px-8">{children}</main>
    </div>
  );
}
