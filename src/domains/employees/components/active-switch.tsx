"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

import { setMemberActive } from "../actions";
import type { MemberRow } from "../queries";

export function ActiveSwitch({
  member,
  isSelf,
}: {
  member: MemberRow;
  isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(isActive: boolean) {
    startTransition(async () => {
      const result = await setMemberActive({
        id: member.id,
        is_active: isActive,
      });
      if (result.error) toast.error(result.error);
      else
        toast.success(
          isActive
            ? `${member.full_name} activated`
            : `${member.full_name} deactivated`,
        );
    });
  }

  return (
    <>
      <Switch
        checked={member.is_active}
        disabled={isSelf || pending}
        aria-label={`${member.full_name} is active`}
        title={isSelf ? "You cannot deactivate your own account." : undefined}
        onCheckedChange={(checked) =>
          checked ? save(true) : setConfirming(true)
        }
      />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {member.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out of ServiceOps and cannot be assigned new
              jobs. Jobs already assigned to them stay assigned until you
              reassign them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => save(false)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
