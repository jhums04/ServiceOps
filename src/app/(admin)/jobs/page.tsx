import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/pagination";
import { JobFilters } from "@/domains/jobs/components/job-filters";
import { JobsTable } from "@/domains/jobs/components/jobs-table";
import { NewJobButton } from "@/domains/jobs/components/new-job-button";
import {
  getJobFormOptions,
  JOBS_PAGE_SIZE,
  listJobs,
} from "@/domains/jobs/queries";
import { jobListParamsSchema } from "@/domains/jobs/schemas";
import { requireAdmin } from "@/lib/auth";
import { todayInZone } from "@/lib/dates";
import { toQueryString } from "@/lib/search-params";

export const metadata: Metadata = { title: "Jobs | ServiceOps" };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const params = jobListParamsSchema.parse(await searchParams);
  const member = await requireAdmin();
  const timeZone = member.organization.time_zone;
  const today = todayInZone(timeZone);
  const [{ jobs, total }, options] = await Promise.all([
    listJobs(params, timeZone),
    getJobFormOptions(),
  ]);
  const filtered = Boolean(params.status || params.technician || params.date);
  const newJob = (
    <NewJobButton options={options} timeZone={timeZone} defaultDate={today} />
  );

  return (
    <>
      <PageHeader title="Jobs" actions={newJob} />
      <JobFilters params={params} technicians={options.technicians} />
      {jobs.length === 0 ? (
        filtered ? (
          <EmptyState message="No jobs match these filters." />
        ) : (
          <EmptyState message="No jobs yet." action={newJob} />
        )
      ) : (
        <>
          <JobsTable
            jobs={jobs}
            options={options}
            timeZone={timeZone}
            today={today}
          />
          <Pagination
            page={params.page}
            pageSize={JOBS_PAGE_SIZE}
            total={total}
            hrefForPage={(page) =>
              `/jobs${toQueryString({ status: params.status, technician: params.technician, date: params.date, page })}`
            }
          />
        </>
      )}
    </>
  );
}
