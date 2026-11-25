import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ActivityList } from "@/domains/dashboard/components/activity-list";
import { RangeSelector } from "@/domains/dashboard/components/range-selector";
import { RevenueChart } from "@/domains/dashboard/components/revenue-chart";
import { getDashboard } from "@/domains/dashboard/queries";
import { dashboardRange, RANGE_LABELS } from "@/domains/dashboard/range";
import { dashboardParamsSchema } from "@/domains/dashboard/schemas";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatTimeRange, todayInZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard | ServiceOps" };

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const params = dashboardParamsSchema.parse(await searchParams);
  const member = await requireAdmin();
  const timeZone = member.organization.time_zone;
  const range = dashboardRange(params.range, todayInZone(timeZone));
  const { summary, series, upcoming, activity } = await getDashboard(range);
  const rangeLabel = `Last ${RANGE_LABELS[params.range]}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<RangeSelector current={params.range} />}
      />

      <dl className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Revenue received"
          value={formatMoney(summary.revenue_cents)}
          note={`${rangeLabel}, ${summary.payment_count} ${plural(summary.payment_count, "payment")}`}
        />
        <Metric
          label="Outstanding"
          value={formatMoney(summary.outstanding_cents)}
          note={`${summary.outstanding_count} unpaid, ${summary.overdue_count} overdue`}
        />
        <Metric
          label="Upcoming jobs"
          value={String(summary.upcoming_jobs)}
          note="Next 7 days"
        />
        <Metric
          label="Completed jobs"
          value={String(summary.completed_jobs)}
          note={rangeLabel}
        />
      </dl>

      <section
        aria-labelledby="revenue-heading"
        className="mb-6 rounded-lg border p-4"
      >
        <h2 id="revenue-heading" className="mb-3 font-semibold">
          Revenue over time
        </h2>
        {summary.revenue_cents === 0 ? (
          <p className="flex h-60 items-center justify-center text-muted-foreground">
            No payments in this range.
          </p>
        ) : (
          <RevenueChart data={series} bucket={range.bucket} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          id="upcoming-heading"
          title="Upcoming jobs"
          action={
            <Link
              href="/calendar"
              className="text-[13px] text-primary hover:underline"
            >
              View calendar
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              No jobs scheduled in the next 7 days.
            </p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((job) => (
                <li
                  key={job.id}
                  className="flex items-start justify-between gap-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.service}</p>
                    <p className="truncate text-muted-foreground">
                      {job.customer.name},{" "}
                      {job.technician?.full_name ?? "Unassigned"}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {formatDate(job.starts_at, timeZone)}
                    <br />
                    {formatTimeRange(job.starts_at, job.ends_at, timeZone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="activity-heading" title="Recent activity">
          <ActivityList items={activity} timeZone={timeZone} />
        </Panel>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border p-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function Panel({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-1 flex items-center justify-between">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function plural(count: number, word: string) {
  return count === 1 ? word : `${word}s`;
}
