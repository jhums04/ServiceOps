"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toQueryString } from "@/lib/search-params";

import type { JobFormOptions } from "../queries";
import { UNASSIGNED, type JobListParams } from "../schemas";
import { JOB_STATUSES, jobStatusLabel } from "../status";

const ALL = "all";

export function JobFilters({
  params,
  technicians,
}: {
  params: JobListParams;
  technicians: JobFormOptions["technicians"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const filtered = params.status || params.technician || params.date;

  function update(
    changes: Partial<Record<"status" | "technician" | "date", string>>,
  ) {
    const next = {
      status: params.status ?? "",
      technician: params.technician ?? "",
      date: params.date ?? "",
      ...changes,
    };
    const query = toQueryString({
      status: next.status === ALL ? "" : next.status,
      technician: next.technician === ALL ? "" : next.technician,
      date: next.date,
    });
    startTransition(() => router.replace(`${pathname}${query}`));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select
        value={params.status ?? ALL}
        onValueChange={(status) => update({ status })}
      >
        <SelectTrigger aria-label="Status" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {JOB_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {jobStatusLabel[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.technician ?? ALL}
        onValueChange={(technician) => update({ technician })}
      >
        <SelectTrigger aria-label="Technician" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All technicians</SelectItem>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {technicians.map((technician) => (
            <SelectItem key={technician.id} value={technician.id}>
              {technician.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        aria-label="Date"
        className="w-40"
        value={params.date ?? ""}
        onChange={(event) => update({ date: event.target.value })}
      />
      {filtered && (
        <Button
          variant="ghost"
          onClick={() => startTransition(() => router.replace(pathname))}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
