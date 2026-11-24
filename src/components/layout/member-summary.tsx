import type { Member } from "@/lib/auth";

import { SignOutButton } from "./sign-out-button";

export function MemberSummary({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {member.full_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {member.organization.name}
        </p>
      </div>
      <SignOutButton />
    </div>
  );
}
