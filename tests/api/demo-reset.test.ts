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

beforeAll(resetDemoData);
afterAll(resetDemoData);

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

  it("regenerates demo data and restores a demo password a visitor changed", async () => {
    const technician = await signInAs(users.alex);
    const { error: changeError } = await technician.auth.updateUser({
      password: "changed-by-a-visitor",
    });
    expect(changeError).toBeNull();
    const locked = await anonClient().auth.signInWithPassword({
      email: users.alex,
      password: PASSWORD,
    });
    expect(locked.error).not.toBeNull();

    const response = await reset(`Bearer ${secret}`);

    expect(response.status).toBe(200);
    expect(await customerCount()).toBe(12);
    const restored = await anonClient().auth.signInWithPassword({
      email: users.alex,
      password: PASSWORD,
    });
    expect(restored.error).toBeNull();
  });
});
