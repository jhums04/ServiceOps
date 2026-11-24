"use client";

import { useState, type ReactNode } from "react";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { useFormAction } from "@/hooks/use-form-action";

import { saveCustomer } from "../actions";

export type CustomerFormValues = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function CustomerSheet({
  customer,
  trigger,
}: {
  customer?: CustomerFormValues;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{customer ? "Edit customer" : "New customer"}</SheetTitle>
          <SheetDescription>
            Contact details and service address.
          </SheetDescription>
        </SheetHeader>
        <CustomerForm
          customer={customer}
          onSaved={() => {
            setOpen(false);
            toast.success(customer ? "Customer updated" : "Customer created");
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function CustomerForm({
  customer,
  onSaved,
}: {
  customer?: CustomerFormValues;
  onSaved: () => void;
}) {
  const { state, onSubmit, pending, fieldErrors } = useFormAction(
    saveCustomer,
    onSaved,
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
        {customer && <input type="hidden" name="id" value={customer.id} />}
        <FormField id="name" label="Name" error={fieldErrors.name}>
          <Input
            {...fieldProps("name", fieldErrors.name)}
            defaultValue={customer?.name}
            autoComplete="off"
          />
        </FormField>
        <FormField id="email" label="Email" error={fieldErrors.email}>
          <Input
            {...fieldProps("email", fieldErrors.email)}
            type="email"
            defaultValue={customer?.email ?? ""}
            autoComplete="off"
          />
        </FormField>
        <FormField id="phone" label="Phone" error={fieldErrors.phone}>
          <Input
            {...fieldProps("phone", fieldErrors.phone)}
            type="tel"
            defaultValue={customer?.phone ?? ""}
            autoComplete="off"
          />
        </FormField>
        <FormField id="street" label="Street" error={fieldErrors.street}>
          <Input
            {...fieldProps("street", fieldErrors.street)}
            defaultValue={customer?.street ?? ""}
            autoComplete="off"
          />
        </FormField>
        <FormField id="city" label="City" error={fieldErrors.city}>
          <Input
            {...fieldProps("city", fieldErrors.city)}
            defaultValue={customer?.city ?? ""}
            autoComplete="off"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField id="state" label="State" error={fieldErrors.state}>
            <Input
              {...fieldProps("state", fieldErrors.state)}
              defaultValue={customer?.state ?? ""}
              autoComplete="off"
            />
          </FormField>
          <FormField
            id="postal_code"
            label="Postal code"
            error={fieldErrors.postal_code}
          >
            <Input
              {...fieldProps("postal_code", fieldErrors.postal_code)}
              defaultValue={customer?.postal_code ?? ""}
              autoComplete="off"
            />
          </FormField>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <SheetFooter className="border-t">
        <Button type="submit" disabled={pending}>
          {customer ? "Save changes" : "Create customer"}
        </Button>
      </SheetFooter>
    </form>
  );
}
