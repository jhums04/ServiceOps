import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CalendarGrid } from "@/domains/jobs/components/calendar-grid";
import { TechnicianFilter } from "@/domains/jobs/components/technician-filter";
import { getJobFormOptions, listWeekJobs } from "@/domains/jobs/queries";
import { calendarParamsSchema } from "@/domains/jobs/schemas";
import { requireAdmin } from "@/lib/auth";
import {
  addDays,
  formatCalendarDate,
  startOfWeek,
  todayInZone,
} from "@/lib/dates";
import { toQueryString } from "@/lib/search-params";

export const metadata: Metadata = { title: "Calendar | ServiceOps" };

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const params = calendarParamsSchema.parse(await searchParams);
  const member = await requireAdmin();
  const timeZone = member.organization.time_zone;
  const today = todayInZone(timeZone);
  const weekStart = startOfWeek(params.week ?? today);
  const [jobs, options] = await Promise.all([
    listWeekJobs(weekStart, timeZone, params.technician),
    getJobFormOptions(),
  ]);

  const weekHref = (week?: string) =>
    `/calendar${toQueryString({ week, technician: params.technician })}`;
  const weekLabel = `${formatCalendarDate(weekStart, { month: "short", day: "numeric" })} - ${formatCalendarDate(addDays(weekStart, 6), { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <>
      <PageHeader title="Calendar" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link
            href={weekHref(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={weekHref(addDays(weekStart, 7))} aria-label="Next week">
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={weekHref()}>This week</Link>
        </Button>
        <h2 className="mx-2 font-medium tabular-nums">{weekLabel}</h2>
        <div className="ml-auto">
          <TechnicianFilter
            value={params.technician}
            technicians={options.technicians}
          />
        </div>
      </div>
      <CalendarGrid
        jobs={jobs}
        weekStart={weekStart}
        today={today}
        timeZone={timeZone}
        options={options}
      />
    </>
  );
}
