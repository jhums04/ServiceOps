import { expect, test } from "@playwright/test";

import { serviceClient, signInAsDemo } from "./support";

test("a technician replaying an administrator Server Action is denied", async ({
  browser,
}) => {
  const name = `Replay check ${Date.now()}`;

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signInAsDemo(admin, "administrator");
  await admin.goto("/customers");
  await admin.getByRole("button", { name: "New customer" }).first().click();
  await admin.getByRole("dialog").getByLabel("Name").fill(name);

  const [actionRequest] = await Promise.all([
    admin.waitForRequest(
      (request) =>
        request.method() === "POST" && "next-action" in request.headers(),
    ),
    admin.getByRole("button", { name: "Create customer" }).click(),
  ]);
  await expect(admin.getByText("Customer created")).toBeVisible();

  const technicianContext = await browser.newContext();
  const technician = await technicianContext.newPage();
  await signInAsDemo(technician, "technician");

  // Same action id and payload, but carried by the technician's session cookies.
  const headers = actionRequest.headers();
  await technician.request.post(actionRequest.url(), {
    headers: {
      "next-action": headers["next-action"] ?? "",
      "content-type": headers["content-type"] ?? "",
      accept: "text/x-component",
      origin: new URL(actionRequest.url()).origin,
    },
    data: actionRequest.postDataBuffer() ?? undefined,
  });

  const { count } = await serviceClient()
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("name", name);
  expect(count).toBe(1);

  await adminContext.close();
  await technicianContext.close();
});

test("a technician cannot open administrator pages", async ({ page }) => {
  await signInAsDemo(page, "technician");
  for (const path of ["/customers", "/jobs", "/calendar", "/employees"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/tech");
  }
});
