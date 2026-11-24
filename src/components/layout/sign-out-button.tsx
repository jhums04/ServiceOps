import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/domains/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut aria-hidden />
      </Button>
    </form>
  );
}
