import { ChevronLeft, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { StatusDot } from "@/components/status-dot";
import { formatAddress } from "@/domains/customers/format";
import { TechnicianJobActions } from "@/domains/jobs/components/technician-job-actions";
import { getTechnicianJob } from "@/domains/jobs/queries";
import { jobStatusLabel, jobStatusTone } from "@/domains/jobs/status";
import { getMember } from "@/lib/auth";
import { formatDate, formatTimeRange } from "@/lib/dates";

export const metadata: Metadata = { title: "Job | ServiceOps" };

export default async function TechnicianJobPage({
  params,
}: PageProps<"/tech/jobs/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [member, job] = await Promise.all([getMember(), getTechnicianJob(id)]);
  if (!job) notFound();

  const timeZone = member.organization.time_zone;
  const address = formatAddress(job.customer);

  return (
    <article className="space-y-6">
      <div>
        <Link
          href="/tech"
          className="mb-3 -ml-1 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          All jobs
        </Link>
        <h1 className="text-xl font-semibold">{job.service}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusDot
            tone={jobStatusTone[job.status]}
            label={jobStatusLabel[job.status]}
          />
          <span className="text-muted-foreground tabular-nums">
            {formatDate(job.starts_at, timeZone)},{" "}
            {formatTimeRange(job.starts_at, job.ends_at, timeZone)}
          </span>
        </div>
      </div>

      <section
        aria-labelledby="customer-heading"
        className="space-y-3 rounded-xl border p-4"
      >
        <h2 id="customer-heading" className="font-medium">
          {job.customer.name}
        </h2>
        {address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-primary underline-offset-4 hover:underline"
          >
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {address}
          </a>
        )}
        {job.customer.phone && (
          <a
            href={`tel:${job.customer.phone.replace(/[^\d+]/g, "")}`}
            className="flex items-center gap-2 text-primary underline-offset-4 hover:underline"
          >
            <Phone aria-hidden className="size-4 shrink-0" />
            {job.customer.phone}
          </a>
        )}
      </section>

      {job.description && (
        <section aria-labelledby="description-heading">
          <h2 id="description-heading" className="mb-1 font-medium">
            Description
          </h2>
          <p className="whitespace-pre-line">{job.description}</p>
        </section>
      )}

      {job.completion_notes && (
        <section aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="mb-1 font-medium">
            Completion notes
          </h2>
          <p className="whitespace-pre-line">{job.completion_notes}</p>
        </section>
      )}

      <TechnicianJobActions jobId={job.id} status={job.status} />
    </article>
  );
}
