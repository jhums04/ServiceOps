"use client";

import { useState } from "react";

import { StatusDot } from "@/components/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import type { JobFormOptions, JobRow } from "../queries";
import { jobStatusLabel, jobStatusTone } from "../status";
import { JobSheet } from "./job-sheet";

export function JobsTable({
  jobs,
  options,
  timeZone,
  today,
}: {
  jobs: JobRow[];
  options: JobFormOptions;
  timeZone: string;
  today: string;
}) {
  const [selected, setSelected] = useState<JobRow | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Technician</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              className="cursor-pointer"
              onClick={() => setSelected(job)}
            >
              <TableCell>{formatDate(job.starts_at, timeZone)}</TableCell>
              <TableCell>
                {formatTimeRange(job.starts_at, job.ends_at, timeZone)}
              </TableCell>
              <TableCell className="font-medium">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(job);
                  }}
                >
                  {job.customer.name}
                </button>
              </TableCell>
              <TableCell>{job.service}</TableCell>
              <TableCell>
                {job.technician?.full_name ?? (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <StatusDot
                  tone={jobStatusTone[job.status]}
                  label={jobStatusLabel[job.status]}
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(job.price_cents)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <JobSheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        job={selected}
        options={options}
        timeZone={timeZone}
        defaultDate={today}
      />
    </>
  );
}
