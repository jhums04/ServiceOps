"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { fieldProps, FormField } from "@/components/form-field";
import { StatusDot } from "@/components/status-dot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import {
  durationMinutes,
  formatDate,
  formatDuration,
  formatTimeRange,
  toZonedDate,
  toZonedTime,
} from "@/lib/dates";
import { centsToInput } from "@/lib/money";

import { generateInvoice } from "@/domains/invoices/actions";

import { cancelJob, saveJob } from "../actions";
import type { JobFormOptions, JobRow } from "../queries";
import { DURATION_OPTIONS, UNASSIGNED } from "../schemas";
import {
  canTransition,
  isSchedulable,
  jobStatusLabel,
  jobStatusTone,
} from "../status";

export type JobSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobRow | null;
  options: JobFormOptions;
  timeZone: string;
  defaultDate: string;
};

export function JobSheet({
  open,
  onOpenChange,
  job,
  options,
  timeZone,
  defaultDate,
}: JobSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{job ? job.service : "New job"}</SheetTitle>
          <SheetDescription asChild>
            {job ? (
              <div className="flex items-center gap-3">
                <StatusDot
                  tone={jobStatusTone[job.status]}
                  label={jobStatusLabel[job.status]}
                />
                <span>{job.customer.name}</span>
              </div>
            ) : (
              <p>Schedule work for a customer.</p>
            )}
          </SheetDescription>
        </SheetHeader>
        {open && (
          <JobForm
            key={job?.id ?? "new"}
            job={job}
            options={options}
            timeZone={timeZone}
            defaultDate={defaultDate}
            onDone={(message) => {
              onOpenChange(false);
              toast.success(message);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function JobForm({
  job,
  options,
  timeZone,
  defaultDate,
  onDone,
}: Omit<JobSheetProps, "open" | "onOpenChange"> & {
  onDone: (message: string) => void;
}) {
  const { state, onSubmit, pending, fieldErrors } = useFormAction(saveJob, () =>
    onDone(job ? "Job updated" : "Job scheduled"),
  );
  const schedulable = !job || isSchedulable(job.status);

  // A job may be assigned to someone deactivated since; keep them selectable as-is.
  const technicians =
    job?.technician_id &&
    !options.technicians.some((t) => t.id === job.technician_id)
      ? [
          ...options.technicians,
          {
            id: job.technician_id,
            full_name: `${job.technician?.full_name ?? "Unknown"} (inactive)`,
          },
        ]
      : options.technicians;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4">
        {job && <input type="hidden" name="id" value={job.id} />}

        {schedulable ? (
          <FormField
            id="customer_id"
            label="Customer"
            error={fieldErrors.customer_id}
          >
            <Select name="customer_id" defaultValue={job?.customer_id}>
              <SelectTrigger
                {...selectProps("customer_id", fieldErrors.customer_id)}
              >
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                {options.customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}

        <FormField id="service" label="Service" error={fieldErrors.service}>
          <Input
            {...fieldProps("service", fieldErrors.service)}
            defaultValue={job?.service}
            autoComplete="off"
          />
        </FormField>
        <FormField
          id="description"
          label="Description"
          error={fieldErrors.description}
        >
          <Textarea
            {...fieldProps("description", fieldErrors.description)}
            defaultValue={job?.description ?? ""}
            rows={3}
          />
        </FormField>
        <FormField id="price" label="Price (USD)" error={fieldErrors.price}>
          <Input
            {...fieldProps("price", fieldErrors.price)}
            inputMode="decimal"
            defaultValue={job ? centsToInput(job.price_cents) : ""}
            placeholder="0.00"
            autoComplete="off"
            className="tabular-nums"
          />
        </FormField>

        {schedulable ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField id="date" label="Date" error={fieldErrors.date}>
                <Input
                  {...fieldProps("date", fieldErrors.date)}
                  type="date"
                  defaultValue={
                    job ? toZonedDate(job.starts_at, timeZone) : defaultDate
                  }
                />
              </FormField>
              <FormField id="start_time" label="Start time" error={undefined}>
                <Input
                  {...fieldProps("start_time", fieldErrors.start_time)}
                  type="time"
                  step={900}
                  defaultValue={
                    job ? toZonedTime(job.starts_at, timeZone) : "09:00"
                  }
                />
              </FormField>
            </div>
            {fieldErrors.start_time?.[0] && (
              <p
                id="start_time-error"
                role="alert"
                className="-mt-2 text-sm text-destructive"
              >
                {fieldErrors.start_time[0]}
              </p>
            )}
            <FormField
              id="duration_minutes"
              label="Duration"
              error={fieldErrors.duration_minutes}
            >
              <Select
                name="duration_minutes"
                defaultValue={String(
                  job ? durationMinutes(job.starts_at, job.ends_at) : 60,
                )}
              >
                <SelectTrigger
                  {...selectProps(
                    "duration_minutes",
                    fieldErrors.duration_minutes,
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {withCurrent(
                    DURATION_OPTIONS,
                    job
                      ? durationMinutes(job.starts_at, job.ends_at)
                      : undefined,
                  ).map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {formatDuration(minutes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              id="technician_id"
              label="Technician"
              error={fieldErrors.technician_id}
            >
              <Select
                name="technician_id"
                defaultValue={job?.technician_id ?? UNASSIGNED}
              >
                <SelectTrigger
                  {...selectProps("technician_id", fieldErrors.technician_id)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {technicians.map((technician) => (
                    <SelectItem key={technician.id} value={technician.id}>
                      {technician.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </>
        ) : (
          job && (
            <dl className="grid gap-3 rounded-lg border p-3">
              <div>
                <dt className="text-muted-foreground">When</dt>
                <dd>
                  {formatDate(job.starts_at, timeZone)},{" "}
                  {formatTimeRange(job.starts_at, job.ends_at, timeZone)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Technician</dt>
                <dd>{job.technician?.full_name ?? "Unassigned"}</dd>
              </div>
              {job.completion_notes && (
                <div>
                  <dt className="text-muted-foreground">Completion notes</dt>
                  <dd className="whitespace-pre-line">
                    {job.completion_notes}
                  </dd>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Only scheduled jobs can be rescheduled or reassigned.
              </p>
            </dl>
          )
        )}

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-between border-t">
        {job && canTransition(job.status, "cancelled") ? (
          <CancelJobButton
            job={job}
            onCancelled={() => onDone("Job cancelled")}
          />
        ) : job?.status === "completed" ? (
          <InvoiceAction job={job} />
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {job ? "Save changes" : "Schedule job"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function selectProps(id: string, error?: string[]) {
  return {
    id,
    className: "w-full",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

/** Keeps a stored duration selectable even if it is not one of the standard options. */
function withCurrent(values: readonly number[], current?: number) {
  return current === undefined || values.includes(current)
    ? values
    : [...values, current].sort((a, b) => a - b);
}

function CancelJobButton({
  job,
  onCancelled,
}: {
  job: JobRow;
  onCancelled: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
        >
          Cancel job
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
          <AlertDialogDescription>
            {job.service} for {job.customer.name} will be cancelled and its time
            slot freed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep job</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const result = await cancelJob(job.id);
                if (result.error) toast.error(result.error);
                else onCancelled();
              })
            }
          >
            Cancel job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InvoiceAction({ job }: { job: JobRow }) {
  const [pending, startTransition] = useTransition();
  const [generated, setGenerated] = useState<{ id: string; number: number }>();
  const invoice =
    generated ?? job.invoices.find((candidate) => candidate.status !== "void");

  if (invoice) {
    return (
      <Button type="button" variant="outline" asChild>
        <Link href={`/invoices?invoice=${invoice.id}`}>
          Invoice <span className="font-mono">{invoice.number}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await generateInvoice(job.id);
          if (result.invoice) {
            setGenerated(result.invoice);
            toast.success(`Invoice ${result.invoice.number} created`);
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      Generate invoice
    </Button>
  );
}
