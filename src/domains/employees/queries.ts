import "server-only";

import {
  addDays,
  durationMinutes,
  startOfWeek,
  todayInZone,
  zonedDayRange,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** Members with the minutes of non-cancelled work assigned to them this week (Mon-Sun). */
export async function listMembers(timeZone: string) {
  const supabase = await createClient();
  const weekStart = startOfWeek(todayInZone(timeZone));
  const { start, end } = zonedDayRange(
    weekStart,
    addDays(weekStart, 7),
    timeZone,
  );

  const [members, jobs] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, role, full_name, phone, is_active")
      .order("role")
      .order("full_name"),
    supabase
      .from("jobs")
      .select("technician_id, starts_at, ends_at")
      .not("technician_id", "is", null)
      .neq("status", "cancelled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString()),
  ]);
  if (members.error) throw members.error;
  if (jobs.error) throw jobs.error;

  const minutesByMember = new Map<string, number>();
  for (const job of jobs.data) {
    if (!job.technician_id) continue;
    const minutes = durationMinutes(job.starts_at, job.ends_at);
    minutesByMember.set(
      job.technician_id,
      (minutesByMember.get(job.technician_id) ?? 0) + minutes,
    );
  }

  return members.data.map((member) => ({
    ...member,
    week_minutes: minutesByMember.get(member.id) ?? 0,
  }));
}

export type MemberRow = Awaited<ReturnType<typeof listMembers>>[number];
