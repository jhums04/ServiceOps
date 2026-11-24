"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import type { ActionState } from "@/lib/forms";

/**
 * Runs a Server Action from a form's submit event. Dispatching outside the form's
 * `action` prop keeps React from resetting the fields, so input survives a
 * validation error.
 */
export function useFormAction(
  action: (state: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess: () => void,
) {
  const [state, dispatch, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await action(previous, formData);
      if (result.ok) onSuccess();
      return result;
    },
    {},
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, onSubmit, pending, fieldErrors: state.fieldErrors ?? {} };
}
