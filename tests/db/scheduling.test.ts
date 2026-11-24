import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  FAIRVIEW_ID,
  memberIdFor,
  resetDemoData,
  serviceClient,
  signInAs,
  users,
} from "./clients";

const service = serviceClient();

let admin: SupabaseClient<Database>;
let alexId: string;
let jennaId: string;
let customerId: string;

function job(technicianId: string | null, startsAt: string, endsAt: string) {
  return {
    organization_id: FAIRVIEW_ID,
    customer_id: customerId,
    technician_id: technicianId,
    service: "Test job",
    price_cents: 10000,
    starts_at: startsAt,
    ends_at: endsAt,
  };
}

beforeAll(async () => {
  await resetDemoData();
  admin = await signInAs(users.fairviewAdmin);
  [alexId, jennaId] = await Promise.all([
    memberIdFor(users.alex),
    memberIdFor(users.jenna),
  ]);
  const { data } = await service
    .from("customers")
    .select("id")
    .eq("organization_id", FAIRVIEW_ID)
    .limit(1)
    .single();
  customerId = data?.id ?? "";
});

afterAll(resetDemoData);

describe("technician overlap", () => {
  it("rejects an overlapping job and accepts a back-to-back one", async () => {
    const first = await admin
      .from("jobs")
      .insert(job(alexId, "2030-01-07T15:00:00Z", "2030-01-07T16:00:00Z"));
    expect(first.error).toBeNull();

    const overlapping = await admin
      .from("jobs")
      .insert(job(alexId, "2030-01-07T15:30:00Z", "2030-01-07T16:30:00Z"));
    expect(overlapping.error?.code).toBe("23P01");

    const backToBack = await admin
      .from("jobs")
      .insert(job(alexId, "2030-01-07T16:00:00Z", "2030-01-07T17:00:00Z"));
    expect(backToBack.error).toBeNull();
  });

  it("allows the same slot for different technicians and unassigned jobs", async () => {
    const slot = ["2030-01-08T15:00:00Z", "2030-01-08T16:00:00Z"] as const;
    for (const technicianId of [alexId, jennaId, null, null]) {
      const { error } = await admin
        .from("jobs")
        .insert(job(technicianId, ...slot));
      expect(error).toBeNull();
    }
  });

  it("lets exactly one of two concurrent inserts for the same slot succeed", async () => {
    const secondAdmin = await signInAs(users.fairviewAdmin);
    const slot = ["2030-01-09T15:00:00Z", "2030-01-09T17:00:00Z"] as const;

    const results = await Promise.all([
      admin.from("jobs").insert(job(alexId, ...slot)),
      secondAdmin
        .from("jobs")
        .insert(job(alexId, "2030-01-09T16:00:00Z", "2030-01-09T18:00:00Z")),
    ]);

    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expect(results.find((result) => result.error)?.error?.code).toBe("23P01");

    const { count } = await service
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("technician_id", alexId)
      .gte("starts_at", "2030-01-09T00:00:00Z")
      .lt("starts_at", "2030-01-10T00:00:00Z");
    expect(count).toBe(1);
  });

  it("frees the slot when a job is cancelled", async () => {
    const slot = ["2030-01-10T15:00:00Z", "2030-01-10T16:00:00Z"] as const;
    const { data: created } = await admin
      .from("jobs")
      .insert(job(alexId, ...slot))
      .select("id")
      .single();

    const cancel = await admin.rpc("update_job_status", {
      p_job_id: created?.id ?? "",
      p_status: "cancelled",
    });
    expect(cancel.error).toBeNull();

    const replacement = await admin.from("jobs").insert(job(alexId, ...slot));
    expect(replacement.error).toBeNull();
  });
});

describe("job status transitions", () => {
  async function seededJob(status: Database["public"]["Enums"]["job_status"]) {
    const { data } = await service
      .from("jobs")
      .select("id")
      .eq("organization_id", FAIRVIEW_ID)
      .eq("status", status)
      .not("technician_id", "is", null)
      .limit(1)
      .single();
    return data?.id ?? "";
  }

  it("rejects completed -> scheduled", async () => {
    const { error } = await admin
      .from("jobs")
      .update({ status: "scheduled" })
      .eq("id", await seededJob("completed"));
    expect(error?.code).toBe("23514");
  });

  it("rejects scheduled -> completed", async () => {
    const { error } = await admin.rpc("update_job_status", {
      p_job_id: await seededJob("scheduled"),
      p_status: "completed",
    });
    expect(error?.code).toBe("23514");
  });

  it("rejects leaving a terminal status", async () => {
    const { error } = await admin.rpc("update_job_status", {
      p_job_id: await seededJob("cancelled"),
      p_status: "in_progress",
    });
    expect(error?.code).toBe("23514");
  });

  it("rejects starting an unassigned job", async () => {
    const { data } = await admin
      .from("jobs")
      .insert(job(null, "2030-01-11T15:00:00Z", "2030-01-11T16:00:00Z"))
      .select("id")
      .single();
    const { error } = await admin.rpc("update_job_status", {
      p_job_id: data?.id ?? "",
      p_status: "in_progress",
    });
    expect(error?.code).toBe("23514");
  });

  it("rejects rescheduling or reassigning a job that is not scheduled", async () => {
    const id = await seededJob("completed");
    const reschedule = await admin
      .from("jobs")
      .update({
        starts_at: "2030-02-01T15:00:00Z",
        ends_at: "2030-02-01T16:00:00Z",
      })
      .eq("id", id);
    expect(reschedule.error?.code).toBe("23514");

    const { data: current } = await service
      .from("jobs")
      .select("technician_id")
      .eq("id", id)
      .single();
    const otherTechnician =
      current?.technician_id === jennaId ? alexId : jennaId;
    const reassign = await admin
      .from("jobs")
      .update({ technician_id: otherTechnician })
      .eq("id", id);
    expect(reassign.error?.code).toBe("23514");
  });

  it("rejects assigning an administrator", async () => {
    const adminMemberId = await memberIdFor(users.fairviewAdmin);
    const { error } = await admin
      .from("jobs")
      .insert(
        job(adminMemberId, "2030-01-12T15:00:00Z", "2030-01-12T16:00:00Z"),
      );
    expect(error?.code).toBe("23514");
  });
});

describe("technician status updates", () => {
  let alex: SupabaseClient<Database>;
  let alexJobId: string;

  beforeAll(async () => {
    alex = await signInAs(users.alex);
    const { data } = await admin
      .from("jobs")
      .insert(job(alexId, "2030-01-14T15:00:00Z", "2030-01-14T16:00:00Z"))
      .select("id")
      .single();
    alexJobId = data?.id ?? "";
  });

  it("starts and completes their own job with notes", async () => {
    const start = await alex.rpc("update_job_status", {
      p_job_id: alexJobId,
      p_status: "in_progress",
    });
    expect(start.error).toBeNull();

    const complete = await alex.rpc("update_job_status", {
      p_job_id: alexJobId,
      p_status: "completed",
      p_notes: "  Replaced the valve.  ",
    });
    expect(complete.error).toBeNull();

    const { data } = await alex
      .from("jobs")
      .select("status, started_at, completed_at, completion_notes")
      .eq("id", alexJobId)
      .single();
    expect(data?.status).toBe("completed");
    expect(data?.started_at).not.toBeNull();
    expect(data?.completed_at).not.toBeNull();
    expect(data?.completion_notes).toBe("Replaced the valve.");
  });

  it("cannot cancel their own job", async () => {
    const { data } = await admin
      .from("jobs")
      .insert(job(alexId, "2030-01-15T15:00:00Z", "2030-01-15T16:00:00Z"))
      .select("id")
      .single();
    const { error } = await alex.rpc("update_job_status", {
      p_job_id: data?.id ?? "",
      p_status: "cancelled",
    });
    expect(error?.code).toBe("42501");
  });

  it("cannot change another technician's job", async () => {
    const { data } = await admin
      .from("jobs")
      .insert(job(jennaId, "2030-01-16T15:00:00Z", "2030-01-16T16:00:00Z"))
      .select("id")
      .single();
    const { error } = await alex.rpc("update_job_status", {
      p_job_id: data?.id ?? "",
      p_status: "in_progress",
    });
    expect(error?.code).toBe("P0002");

    const { data: unchanged } = await service
      .from("jobs")
      .select("status")
      .eq("id", data?.id ?? "")
      .single();
    expect(unchanged?.status).toBe("scheduled");
  });
});
