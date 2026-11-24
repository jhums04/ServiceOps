"use client";

import { toast } from "sonner";

import { fieldProps, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";

import { updateOwnJobStatus } from "../actions";
import type { JobStatus } from "../status";

export function TechnicianJobActions({
  jobId,
  status,
}: {
  jobId: string;
  status: JobStatus;
}) {
  if (status === "scheduled") return <StartJobForm jobId={jobId} />;
  if (status === "in_progress") return <CompleteJobForm jobId={jobId} />;
  return null;
}

function StartJobForm({ jobId }: { jobId: string }) {
  const { state, onSubmit, pending } = useFormAction(updateOwnJobStatus, () =>
    toast.success("Job started"),
  );
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="id" value={jobId} />
      <input type="hidden" name="status" value="in_progress" />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={pending}
      >
        Start job
      </Button>
    </form>
  );
}

function CompleteJobForm({ jobId }: { jobId: string }) {
  const { state, onSubmit, pending, fieldErrors } = useFormAction(
    updateOwnJobStatus,
    () => toast.success("Job completed"),
  );
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <input type="hidden" name="id" value={jobId} />
      <input type="hidden" name="status" value="completed" />
      <FormField id="notes" label="Completion notes" error={fieldErrors.notes}>
        <Textarea
          {...fieldProps("notes", fieldErrors.notes)}
          rows={4}
          placeholder="What was done, parts used, follow-up needed"
        />
      </FormField>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={pending}
      >
        Complete job
      </Button>
    </form>
  );
}
