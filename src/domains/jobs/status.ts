import type { StatusTone } from "@/components/status-dot";
import type { Database } from "@/lib/supabase/database.types";

export type JobStatus = Database["public"]["Enums"]["job_status"];

export const JOB_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const jobStatusLabel: Record<JobStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const jobStatusTone: Record<JobStatus, StatusTone> = {
  scheduled: "amber",
  in_progress: "amber",
  completed: "green",
  cancelled: "gray",
};

// Mirrors the jobs trigger so the UI only offers transitions the database accepts.
const transitions: Record<JobStatus, readonly JobStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus) {
  return transitions[from].includes(to);
}

/** Only scheduled jobs can be rescheduled or reassigned. */
export function isSchedulable(status: JobStatus) {
  return status === "scheduled";
}
