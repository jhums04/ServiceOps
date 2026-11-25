import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusDot } from "@/components/status-dot";
import { formatAddress } from "@/domains/customers/format";
import { formatTimeRange } from "@/lib/dates";

import { jobStatusLabel, jobStatusTone, type JobStatus } from "../status";

export type TechnicianJob = {
  id: string;
  service: string;
  starts_at: string;
  ends_at: string;
  status: JobStatus;
  customer: {
    name: string;
    street: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  };
};

export function TechnicianJobList({
  jobs,
  timeZone,
}: {
  jobs: TechnicianJob[];
  timeZone: string;
}) {
  return (
    <ul className="divide-y rounded-xl border">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link
            href={`/tech/jobs/${job.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium tabular-nums">
                {formatTimeRange(job.starts_at, job.ends_at, timeZone)}
              </p>
              <p className="truncate">
                {job.service}{" "}
                <span className="text-muted-foreground">
                  for {job.customer.name}
                </span>
              </p>
              <p className="truncate text-muted-foreground">
                {formatAddress(job.customer)}
              </p>
              <StatusDot
                tone={jobStatusTone[job.status]}
                label={jobStatusLabel[job.status]}
              />
            </div>
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
