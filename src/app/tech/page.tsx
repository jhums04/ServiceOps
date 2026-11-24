import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TechnicianJobList } from "@/domains/jobs/components/technician-job-list";
import { listTechnicianJobs } from "@/domains/jobs/queries";
import { getMember } from "@/lib/auth";
import { formatCalendarDate, toZonedDate, todayInZone } from "@/lib/dates";

export const metadata: Metadata = { title: "My jobs | ServiceOps" };

export default async function TechnicianPage() {
  const member = await getMember();
  const timeZone = member.organization.time_zone;
  const { today, upcoming } = await listTechnicianJobs(member.id, timeZone);

  const upcomingByDay = new Map<string, typeof upcoming>();
  for (const job of upcoming) {
    const day = toZonedDate(job.starts_at, timeZone);
    upcomingByDay.set(day, [...(upcomingByDay.get(day) ?? []), job]);
  }

  return (
    <>
      <PageHeader title="Today" />
      <p className="-mt-4 mb-4 text-muted-foreground">
        {formatCalendarDate(todayInZone(timeZone), {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      {today.length === 0 ? (
        <EmptyState message="No jobs today." />
      ) : (
        <TechnicianJobList jobs={today} timeZone={timeZone} />
      )}

      <h2 className="mt-8 mb-3 text-base font-semibold">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState message="No upcoming jobs." />
      ) : (
        <div className="space-y-4">
          {[...upcomingByDay].map(([day, jobs]) => (
            <section key={day} aria-label={day}>
              <h3 className="mb-2 font-medium text-muted-foreground">
                {formatCalendarDate(day, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h3>
              <TechnicianJobList jobs={jobs} timeZone={timeZone} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
