"use client";

import { useState } from "react";

import {
  addDays,
  formatCalendarDate,
  formatTimeRange,
  toZonedDate,
  zonedMinutes,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

import { assignLanes } from "../calendar-layout";
import type { JobFormOptions, JobRow } from "../queries";
import { jobStatusLabel } from "../status";
import { JobSheet } from "./job-sheet";

const HOUR_HEIGHT = 48;
const DEFAULT_FIRST_HOUR = 7;
const DEFAULT_LAST_HOUR = 19;

const statusDotClass: Record<JobRow["status"], string> = {
  scheduled: "bg-status-amber",
  in_progress: "bg-status-amber",
  completed: "bg-status-green",
  cancelled: "bg-status-gray",
};

export function CalendarGrid({
  jobs,
  weekStart,
  today,
  timeZone,
  options,
}: {
  jobs: JobRow[];
  weekStart: string;
  today: string;
  timeZone: string;
  options: JobFormOptions;
}) {
  const [selected, setSelected] = useState<JobRow | null>(null);
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  const positioned = jobs.map((job) => {
    const date = toZonedDate(job.starts_at, timeZone);
    const start = zonedMinutes(job.starts_at, timeZone);
    const endsSameDay = toZonedDate(job.ends_at, timeZone) === date;
    const end = endsSameDay ? zonedMinutes(job.ends_at, timeZone) : 24 * 60;
    return { job, date, start, end };
  });

  const firstHour = Math.min(
    DEFAULT_FIRST_HOUR,
    ...positioned.map((p) => Math.floor(p.start / 60)),
  );
  const lastHour = Math.max(
    DEFAULT_LAST_HOUR,
    ...positioned.map((p) => Math.ceil(p.end / 60)),
  );
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, index) => firstHour + index,
  );

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <div className="grid min-w-[840px] grid-cols-[56px_repeat(7,minmax(0,1fr))]">
          <div className="border-b" />
          {days.map((day) => (
            <div
              key={day}
              className={cn(
                "border-b border-l px-2 py-2 font-medium",
                day === today && "text-primary",
              )}
            >
              {formatCalendarDate(day, { weekday: "short" })}{" "}
              <span className="tabular-nums">
                {formatCalendarDate(day, { day: "numeric" })}
              </span>
            </div>
          ))}

          <div
            className="relative"
            style={{ height: hours.length * HOUR_HEIGHT }}
          >
            {hours.map((hour, index) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                style={{ top: index * HOUR_HEIGHT }}
              >
                {index === 0 ? "" : formatHour(hour)}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day}
              className={cn(
                "relative border-l",
                day === today && "bg-muted/40",
              )}
              style={{ height: hours.length * HOUR_HEIGHT }}
            >
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  aria-hidden
                  className="absolute inset-x-0 border-t"
                  style={{ top: index * HOUR_HEIGHT }}
                />
              ))}
              {assignLanes(positioned.filter((item) => item.date === day)).map(
                ({ job, start, end, lane, lanes }) => {
                  const timeRange = formatTimeRange(
                    job.starts_at,
                    job.ends_at,
                    timeZone,
                  );
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelected(job)}
                      title={`${job.service} for ${job.customer.name}, ${timeRange}`}
                      className="absolute flex flex-col overflow-hidden rounded-md border bg-background px-1.5 py-1 text-left text-xs leading-tight hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      style={{
                        top: ((start - firstHour * 60) / 60) * HOUR_HEIGHT + 1,
                        height: Math.max(
                          ((end - start) / 60) * HOUR_HEIGHT - 2,
                          20,
                        ),
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            statusDotClass[job.status],
                          )}
                        />
                        <span className="truncate">{job.service}</span>
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {job.technician?.full_name ?? "Unassigned"}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {job.customer.name}
                      </span>
                      <span className="sr-only">
                        , {timeRange}, {jobStatusLabel[job.status]}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          ))}
        </div>
      </div>
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

function formatHour(hour: number) {
  const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}
