import "server-only";

import { addDays, todayInZone, zonedDayRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import { UNASSIGNED, type JobListParams } from "./schemas";
import type { JobStatus } from "./status";

export const JOBS_PAGE_SIZE = 50;

const JOB_COLUMNS =
  "id, customer_id, technician_id, service, description, price_cents, starts_at, ends_at, status, completion_notes, customer:customers (name), technician:organization_members (full_name)";

export type JobRow = {
  id: string;
  customer_id: string;
  technician_id: string | null;
  service: string;
  description: string | null;
  price_cents: number;
  starts_at: string;
  ends_at: string;
  status: JobStatus;
  completion_notes: string | null;
  customer: { name: string };
  technician: { full_name: string } | null;
};

export async function listJobs(params: JobListParams, timeZone: string) {
  const supabase = await createClient();
  const from = (params.page - 1) * JOBS_PAGE_SIZE;

  let request = supabase
    .from("jobs")
    .select(JOB_COLUMNS, { count: "exact" })
    .order("starts_at", { ascending: params.date !== undefined })
    .order("id")
    .range(from, from + JOBS_PAGE_SIZE - 1);

  if (params.status) request = request.eq("status", params.status);
  if (params.technician === UNASSIGNED)
    request = request.is("technician_id", null);
  else if (params.technician)
    request = request.eq("technician_id", params.technician);
  if (params.date) {
    const { start, end } = zonedDayRange(
      params.date,
      addDays(params.date, 1),
      timeZone,
    );
    request = request
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString());
  }

  const { data, error, count } = await request;
  if (error) throw error;
  const jobs: JobRow[] = data;
  return { jobs, total: count ?? 0 };
}

/** Jobs starting in the 7 days from weekStart, excluding cancelled ones. */
export async function listWeekJobs(
  weekStart: string,
  timeZone: string,
  technicianId?: string,
) {
  const supabase = await createClient();
  const { start, end } = zonedDayRange(
    weekStart,
    addDays(weekStart, 7),
    timeZone,
  );

  let request = supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .neq("status", "cancelled")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at");
  if (technicianId) request = request.eq("technician_id", technicianId);

  const { data, error } = await request;
  if (error) throw error;
  const jobs: JobRow[] = data;
  return jobs;
}

export async function getJobFormOptions() {
  const supabase = await createClient();
  const [customers, technicians] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase
      .from("organization_members")
      .select("id, full_name")
      .eq("role", "technician")
      .eq("is_active", true)
      .order("full_name"),
  ]);
  if (customers.error) throw customers.error;
  if (technicians.error) throw technicians.error;
  return { customers: customers.data, technicians: technicians.data };
}

export type JobFormOptions = Awaited<ReturnType<typeof getJobFormOptions>>;

const TECHNICIAN_JOB_COLUMNS =
  "id, service, description, starts_at, ends_at, status, completion_notes, customer:customers (name, phone, street, city, state, postal_code)";

/** The signed-in technician's open work: today's jobs, then upcoming scheduled ones. */
export async function listTechnicianJobs(memberId: string, timeZone: string) {
  const supabase = await createClient();
  const today = todayInZone(timeZone);
  const { start, end } = zonedDayRange(today, addDays(today, 1), timeZone);

  const [todayJobs, upcomingJobs] = await Promise.all([
    supabase
      .from("jobs")
      .select(TECHNICIAN_JOB_COLUMNS)
      .eq("technician_id", memberId)
      .neq("status", "cancelled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    supabase
      .from("jobs")
      .select(TECHNICIAN_JOB_COLUMNS)
      .eq("technician_id", memberId)
      .eq("status", "scheduled")
      .gte("starts_at", end.toISOString())
      .order("starts_at")
      .limit(50),
  ]);
  if (todayJobs.error) throw todayJobs.error;
  if (upcomingJobs.error) throw upcomingJobs.error;
  return { today: todayJobs.data, upcoming: upcomingJobs.data };
}

export async function getTechnicianJob(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(TECHNICIAN_JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
