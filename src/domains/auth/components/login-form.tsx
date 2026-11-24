"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, signInAsDemo, type SignInState } from "../actions";

const initialState: SignInState = {};

export function LoginForm() {
  const [state, signInAction, signingIn] = useActionState(signIn, initialState);
  const [demoState, demoAction, demoPending] = useActionState(
    signInAsDemo,
    initialState,
  );
  const pending = signingIn || demoPending;
  const formError = state.error ?? demoState.error;

  return (
    <div className="space-y-6">
      <form action={signInAction} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={
              state.fieldErrors?.email ? "email-error" : undefined
            }
          />
          {state.fieldErrors?.email && (
            <p id="email-error" className="text-sm text-destructive">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={
              state.fieldErrors?.password ? "password-error" : undefined
            }
          />
          {state.fieldErrors?.password && (
            <p id="password-error" className="text-sm text-destructive">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or explore the demo
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={demoAction} className="grid gap-2">
        <Button
          type="submit"
          name="role"
          value="admin"
          variant="outline"
          disabled={pending}
        >
          Explore as administrator
        </Button>
        <Button
          type="submit"
          name="role"
          value="technician"
          variant="outline"
          disabled={pending}
        >
          Explore as technician
        </Button>
      </form>
    </div>
  );
}
