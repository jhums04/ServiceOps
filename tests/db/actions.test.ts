import type { SupabaseClient } from "@supabase/supabase-js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  FAIRVIEW_ID,
  memberIdFor,
  resetDemoData,
  serviceClient,
  signInAs,
  users,
} from "./clients";

// Server Actions run here as plain functions. Only the request-bound pieces are
// replaced: the Supabase client is a real session for the user under test, so RLS and
// the database still decide what happens.
let actor: SupabaseClient<Database>;

class RedirectError extends Error {
  constructor(readonly path: string) {
    super(`redirect ${path}`);
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => actor }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new RedirectError(path);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { saveCustomer } = await import("@/domains/customers/actions");
const { cancelJob, saveJob, updateOwnJobStatus } =
  await import("@/domains/jobs/actions");
const { setMemberActive, updateMember } =
  await import("@/domains/employees/actions");

const service = serviceClient();

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function customerCount(name: string) {
  const { count } = await service
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("name", name);
  return count;
}

async function scheduledJobFor(technicianEmail: string) {
  const { data } = await service
    .from("jobs")
    .select("id")
    .eq("technician_id", await memberIdFor(technicianEmail))
    .eq("status", "scheduled")
    .limit(1)
    .single();
  return data?.id ?? "";
}

beforeAll(resetDemoData);
afterAll(resetDemoData);

describe("a technician calling administrator Server Actions", () => {
  beforeEach(async () => {
    actor = await signInAs(users.alex);
  });

  it("cannot create a customer", async () => {
    const name = "Technician-created customer";
    await expect(saveCustomer({}, form({ name }))).rejects.toMatchObject({
      path: "/tech",
    });
    expect(await customerCount(name)).toBe(0);
  });

  it("cannot schedule or cancel jobs", async () => {
    const { data: customer } = await service
      .from("customers")
      .select("id")
      .eq("organization_id", FAIRVIEW_ID)
      .limit(1)
      .single();
    await expect(
      saveJob(
        {},
        form({
          customer_id: customer?.id ?? "",
          service: "Technician-created job",
          description: "",
          price: "100",
          date: "2030-03-04",
          start_time: "09:00",
          duration_minutes: "60",
          technician_id: "unassigned",
        }),
      ),
    ).rejects.toMatchObject({ path: "/tech" });
    const { count } = await service
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("service", "Technician-created job");
    expect(count).toBe(0);

    const jobId = await scheduledJobFor(users.alex);
    await expect(cancelJob(jobId)).rejects.toMatchObject({ path: "/tech" });
    const { data: job } = await service
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .single();
    expect(job?.status).toBe("scheduled");
  });

  it("cannot edit or deactivate members", async () => {
    const jennaId = await memberIdFor(users.jenna);
    await expect(
      updateMember({}, form({ id: jennaId, full_name: "Renamed", phone: "" })),
    ).rejects.toMatchObject({ path: "/tech" });
    await expect(
      setMemberActive({ id: jennaId, is_active: false }),
    ).rejects.toMatchObject({
      path: "/tech",
    });

    const { data } = await service
      .from("organization_members")
      .select("full_name, is_active")
      .eq("id", jennaId)
      .single();
    expect(data).toEqual({ full_name: "Jenna Kowalski", is_active: true });
  });

  it("can start their own job but not another technician's", async () => {
    const own = await updateOwnJobStatus(
      {},
      form({ id: await scheduledJobFor(users.alex), status: "in_progress" }),
    );
    expect(own).toEqual({ ok: true });

    const other = await updateOwnJobStatus(
      {},
      form({ id: await scheduledJobFor(users.jenna), status: "in_progress" }),
    );
    expect(other.error).toBe("This job is not assigned to you.");
  });
});

describe("an administrator calling the same Server Actions", () => {
  beforeEach(async () => {
    actor = await signInAs(users.fairviewAdmin);
  });

  it("creates a customer", async () => {
    const name = "Administrator-created customer";
    await expect(saveCustomer({}, form({ name }))).resolves.toEqual({
      ok: true,
    });
    expect(await customerCount(name)).toBe(1);
  });

  it("gets an inline conflict error for an overlapping job", async () => {
    const alexId = await memberIdFor(users.alex);
    const { data: customer } = await service
      .from("customers")
      .select("id")
      .eq("organization_id", FAIRVIEW_ID)
      .limit(1)
      .single();
    const values = {
      customer_id: customer?.id ?? "",
      service: "Conflict check",
      description: "",
      price: "100",
      date: "2030-03-05",
      start_time: "09:00",
      duration_minutes: "120",
      technician_id: alexId,
    };

    await expect(saveJob({}, form(values))).resolves.toEqual({ ok: true });
    const conflict = await saveJob(
      {},
      form({ ...values, start_time: "10:00" }),
    );
    expect(conflict.fieldErrors?.start_time?.[0]).toMatch(
      /^Alex Moreno already has a job from 9:00\sAM to 11:00\sAM on Tue, Mar 5, 2030\./,
    );
    await expect(
      saveJob({}, form({ ...values, start_time: "11:00" })),
    ).resolves.toEqual({
      ok: true,
    });
  });
});
