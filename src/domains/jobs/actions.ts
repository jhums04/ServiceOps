"use server";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMember, requireAdmin } from "@/lib/auth";
import { formatDate, formatTime, zonedToUtc } from "@/lib/dates";
import type { ActionState } from "@/lib/forms";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { jobDetailsSchema, jobScheduleSchema } from "./schemas";

const EXCLUSION_VIOLATION = "23P01";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const NO_DATA_FOUND = "P0002";
const PROGRAM_LIMIT_EXCEEDED = "54000";

function revalidateJobs() {
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  revalidatePath("/customers", "layout");
  revalidatePath("/employees");
  revalidatePath("/tech", "layout");
}

async function conflictMessage(
  supabase: SupabaseClient<Database>,
  job: {
    technicianId: string;
    startsAt: string;
    endsAt: string;
    excludeId?: string;
  },
  timeZone: string,
) {
  let request = supabase
    .from("jobs")
    .select("starts_at, ends_at, technician:organization_members (full_name)")
    .eq("technician_id", job.technicianId)
    .in("status", ["scheduled", "in_progress"])
    .lt("starts_at", job.endsAt)
    .gt("ends_at", job.startsAt)
    .limit(1);
  if (job.excludeId) request = request.neq("id", job.excludeId);
  const { data } = await request.maybeSingle();

  if (!data) {
    return "This technician already has a job at this time. Choose another time or technician.";
  }
  const name = data.technician?.full_name ?? "This technician";
  return `${name} already has a job from ${formatTime(data.starts_at, timeZone)} to ${formatTime(data.ends_at, timeZone)} on ${formatDate(data.starts_at, timeZone)}. Choose another time or technician.`;
}

function writeError(error: PostgrestError): ActionState {
  if (error.code === FOREIGN_KEY_VIOLATION) {
    return { fieldErrors: { customer_id: ["Choose a customer."] } };
  }
  if (error.code === PROGRAM_LIMIT_EXCEEDED) return { error: error.message };
  if (error.code === CHECK_VIOLATION) {
    return { error: `${error.message}. Refresh the page and try again.` };
  }
  throw error;
}

export async function saveJob(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const input = Object.fromEntries(formData);
  const details = jobDetailsSchema.safeParse(input);

  const member = await requireAdmin();
  const supabase = await createClient();
  const timeZone = member.organization.time_zone;

  let schedulable = true;
  if (details.success && details.data.id) {
    const { data: current, error } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", details.data.id)
      .maybeSingle();
    if (error) throw error;
    if (!current) return { error: "This job no longer exists." };
    schedulable = current.status === "scheduled";
  }

  const schedule = schedulable ? jobScheduleSchema.safeParse(input) : null;
  if (!details.success || (schedule && !schedule.success)) {
    return {
      fieldErrors: {
        ...(details.success ? {} : z.flattenError(details.error).fieldErrors),
        ...(schedule && !schedule.success
          ? z.flattenError(schedule.error).fieldErrors
          : {}),
      },
    };
  }

  const { id, service, description, price } = details.data;
  const fields = { service, description, price_cents: price };

  if (!schedule) {
    const { error } = await supabase
      .from("jobs")
      .update(fields)
      .eq("id", id ?? "");
    if (error) return writeError(error);
    revalidateJobs();
    return { ok: true };
  }

  const { customer_id, date, start_time, duration_minutes, technician_id } =
    schedule.data;
  const startsAt = zonedToUtc(date, start_time, timeZone);
  const endsAt = new Date(startsAt.getTime() + duration_minutes * 60_000);

  if (technician_id) {
    const { data: technician, error } = await supabase
      .from("organization_members")
      .select("id")
      .eq("id", technician_id)
      .eq("role", "technician")
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!technician) {
      return {
        fieldErrors: { technician_id: ["Choose an active technician."] },
      };
    }
  }

  const row = {
    ...fields,
    customer_id,
    technician_id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  };
  const { error } = id
    ? await supabase.from("jobs").update(row).eq("id", id)
    : await supabase
        .from("jobs")
        .insert({ ...row, organization_id: member.organization_id });

  if (error?.code === EXCLUSION_VIOLATION && technician_id) {
    const message = await conflictMessage(
      supabase,
      {
        technicianId: technician_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        excludeId: id,
      },
      timeZone,
    );
    return { fieldErrors: { start_time: [message] } };
  }
  if (error) return writeError(error);

  revalidateJobs();
  return { ok: true };
}

const jobIdSchema = z.uuid();

export async function cancelJob(jobId: string): Promise<ActionState> {
  const id = jobIdSchema.safeParse(jobId);
  if (!id.success) return { error: "Invalid job." };

  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_job_status", {
    p_job_id: id.data,
    p_status: "cancelled",
  });
  if (error?.code === CHECK_VIOLATION) {
    return { error: "Only scheduled or in-progress jobs can be cancelled." };
  }
  if (error?.code === NO_DATA_FOUND)
    return { error: "This job no longer exists." };
  if (error) throw error;

  revalidateJobs();
  return { ok: true };
}

const statusUpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["in_progress", "completed"]),
  notes: z.string().max(2000, "Use 2000 characters or fewer.").optional(),
});

/** Technician start and complete. Admins may use it too; the function checks both. */
export async function updateOwnJobStatus(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = statusUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  await getMember();
  const supabase = await createClient();
  const { id, status, notes } = parsed.data;
  const { error } = await supabase.rpc("update_job_status", {
    p_job_id: id,
    p_status: status,
    p_notes: notes,
  });

  if (error?.code === NO_DATA_FOUND)
    return { error: "This job is not assigned to you." };
  if (error?.code === CHECK_VIOLATION) {
    return {
      error:
        status === "in_progress"
          ? "This job can no longer be started. Refresh the page to see its current status."
          : "Start the job before completing it.",
    };
  }
  if (error) throw error;

  revalidateJobs();
  return { ok: true };
}
