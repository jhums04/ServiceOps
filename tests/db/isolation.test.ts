import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

import {
  anonClient,
  FAIRVIEW_ID,
  LAKESIDE_ID,
  serviceClient,
  signInAs,
  TABLES,
  users,
} from "./clients";

const service = serviceClient();

// Tables whose rows carry organization_id directly; organizations is keyed by id.
const ORG_SCOPED = [
  "organization_members",
  "customers",
  "jobs",
  "invoices",
  "payments",
] as const;

describe("organization isolation", () => {
  let clients: Record<"fairviewAdmin" | "alex", SupabaseClient<Database>>;

  beforeAll(async () => {
    clients = {
      fairviewAdmin: await signInAs(users.fairviewAdmin),
      alex: await signInAs(users.alex),
    };
  });

  it("the second organization has data to leak", async () => {
    for (const table of ORG_SCOPED) {
      const { count } = await service
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", LAKESIDE_ID);
      expect(count, table).toBeGreaterThan(0);
    }
  });

  for (const actor of ["fairviewAdmin", "alex"] as const) {
    it(`${actor} cannot select any row from the second organization`, async () => {
      const client = clients[actor];

      const organizations = await client.from("organizations").select("id");
      expect(organizations.error).toBeNull();
      expect(organizations.data?.map((row) => row.id)).toEqual([FAIRVIEW_ID]);

      for (const table of ORG_SCOPED) {
        const { data, error } = await client
          .from(table)
          .select("organization_id");
        expect(error, table).toBeNull();
        expect(
          data?.filter((row) => row.organization_id !== FAIRVIEW_ID),
          table,
        ).toEqual([]);
      }
    });
  }

  it("an administrator cannot write into the second organization", async () => {
    const admin = clients.fairviewAdmin;

    const customer = await admin
      .from("customers")
      .insert({ organization_id: LAKESIDE_ID, name: "Cross-org customer" });
    expect(customer.error?.code).toBe("42501");

    const { data: lakesideCustomer } = await service
      .from("customers")
      .select("id")
      .eq("organization_id", LAKESIDE_ID)
      .limit(1)
      .single();

    // Own organization id with a foreign customer: the composite foreign key rejects it.
    const job = await admin.from("jobs").insert({
      organization_id: FAIRVIEW_ID,
      customer_id: lakesideCustomer?.id ?? "",
      service: "Cross-org job",
      price_cents: 100,
      starts_at: "2030-01-01T10:00:00Z",
      ends_at: "2030-01-01T11:00:00Z",
    });
    expect(job.error?.code).toBe("23503");

    const update = await admin
      .from("customers")
      .update({ name: "Renamed" })
      .eq("organization_id", LAKESIDE_ID)
      .select();
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);
  });
});

describe("anonymous access", () => {
  const anon = anonClient();

  for (const table of TABLES) {
    it(`anon cannot select from ${table}`, async () => {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });
  }

  it("anon cannot call reset_demo_data", async () => {
    const { error } = await anon.rpc("reset_demo_data");
    expect(error?.code).toBe("42501");
  });
});
