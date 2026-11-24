import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/**
 * Label, control, and inline error. The control must use `id` and set
 * aria-describedby to `${id}-error` and aria-invalid when an error is present.
 */
export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error?.[0] && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error[0]}
        </p>
      )}
    </div>
  );
}

export function fieldProps(id: string, error?: string[]) {
  return {
    id,
    name: id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}
