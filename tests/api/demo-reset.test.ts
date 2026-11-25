import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  anonClient,
  FAIRVIEW_ID,
  PASSWORD,
  resetDemoData,
  serviceClient,
  signInAs,
  users,
} from "../db/clients";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { POST } = await import("@/app/api/demo/reset/route");
const service = serviceClient();
const secret = process.env.DEMO_RESET_SECRET ?? "";

function reset(authorization?: string) {
  return POST(
    new Request("http://localhost/api/demo/reset", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
  );
}

async function customerCount() {
  const { count } = await service
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", FAIRVIEW_ID);
  return count;
}

async function canSignIn(email: string, password: string) {
  const { error } = await anonClient().auth.signInWithPassword({
    email,
    password,
  });
  return error === null;
}

beforeAll(resetDemoData);
afterAll(async () => {
  await service.rpc("set_demo_password", {
    p_email: users.alex,
    p_password: PASSWORD,
  });
  await resetDemoData();
});

describe("demo account credentials", () => {
  it("cannot be changed by a signed-in visitor", async () => {
    const technician = await signInAs(users.alex);

    const passwordChange = await technician.auth.updateUser({
      password: "changed-by-a-visitor",
    });
    const emailChange = await technician.auth.updateUser({
      email: "visitor@example.net",
    });

    expect(passwordChange.error).not.toBeNull();
    expect(emailChange.error).not.toBeNull();
    expect(await canSignIn(users.alex, PASSWORD)).toBe(true);
    expect(await canSignIn(users.alex, "changed-by-a-visitor")).toBe(false);
    const { data } = await service.auth.admin.listUsers();
    const alex = data.users.find((user) => user.email === users.alex);
    expect(alex?.new_email).toBeFalsy();
  });

  it("cannot be changed through the admin API either", async () => {
    const { data } = await service.auth.admin.listUsers();
    const admin = data.users.find((user) => user.email === users.fairviewAdmin);
    const { error } = await service.auth.admin.updateUserById(admin?.id ?? "", {
      password: "changed-through-admin-api",
    });
    expect(error).not.toBeNull();
    expect(await canSignIn(users.fairviewAdmin, PASSWORD)).toBe(true);
  });

  it("can only be set by the service role", async () => {
    const technician = await signInAs(users.alex);
    const { error } = await technician.rpc("set_demo_password", {
      p_email: users.alex,
      p_password: "a-password-a-visitor-wants",
    });
    expect(error).not.toBeNull();
    expect(await canSignIn(users.alex, PASSWORD)).toBe(true);
  });
});

describe("POST /api/demo/reset", () => {
  it("rejects a missing or wrong secret without touching data", async () => {
    const admin = await signInAs(users.fairviewAdmin);
    await admin
      .from("customers")
      .insert({ organization_id: FAIRVIEW_ID, name: "Visitor customer" });
    const before = await customerCount();

    for (const header of [
      undefined,
      "Bearer wrong-secret-value",
      secret,
      `Basic ${secret}`,
    ]) {
      const response = await reset(header);
      expect(response.status).toBe(401);
    }
    expect(await customerCount()).toBe(before);
  });

  it("regenerates demo data and makes the configured demo password authoritative", async () => {
    const { error: rotateError } = await service.rpc("set_demo_password", {
      p_email: users.alex,
      p_password: "a-previous-demo-password",
    });
    expect(rotateError).toBeNull();
    expect(await canSignIn(users.alex, PASSWORD)).toBe(false);

    const response = await reset(`Bearer ${secret}`);

    expect(response.status).toBe(200);
    expect(await customerCount()).toBe(12);
    expect(await canSignIn(users.alex, PASSWORD)).toBe(true);
  });
});
