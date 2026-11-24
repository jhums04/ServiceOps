"use client";

import { toast } from "sonner";

import { fieldProps, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFormAction } from "@/hooks/use-form-action";

import { updateMember } from "../actions";
import type { MemberRow } from "../queries";

export function MemberSheet({
  member,
  onOpenChange,
}: {
  member: MemberRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={member !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Edit employee</SheetTitle>
          <SheetDescription>
            Name and phone shown to your team.
          </SheetDescription>
        </SheetHeader>
        {member && (
          <MemberForm
            member={member}
            onSaved={() => {
              onOpenChange(false);
              toast.success("Employee updated");
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function MemberForm({
  member,
  onSaved,
}: {
  member: MemberRow;
  onSaved: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors } = useFormAction(
    updateMember,
    onSaved,
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
        <input type="hidden" name="id" value={member.id} />
        <FormField id="full_name" label="Name" error={fieldErrors.full_name}>
          <Input
            {...fieldProps("full_name", fieldErrors.full_name)}
            defaultValue={member.full_name}
            autoComplete="off"
          />
        </FormField>
        <FormField id="phone" label="Phone" error={fieldErrors.phone}>
          <Input
            {...fieldProps("phone", fieldErrors.phone)}
            type="tel"
            defaultValue={member.phone ?? ""}
            autoComplete="off"
          />
        </FormField>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <SheetFooter className="border-t">
        <Button type="submit" disabled={pending}>
          Save changes
        </Button>
      </SheetFooter>
    </form>
  );
}
