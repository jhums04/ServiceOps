import { expect, test } from "@playwright/test";

import { signInAsDemo } from "./support";

test("an overlapping job shows the conflict inline and a back-to-back job is accepted", async ({
  page,
}) => {
  await signInAsDemo(page, "administrator");
  await page.goto("/jobs");

  const sheet = page.getByRole("dialog");
  async function scheduleAt(startTime: string) {
    await sheet.getByLabel("Start time").fill(startTime);
    await sheet.getByRole("button", { name: "Schedule job" }).click();
  }

  await page.getByRole("button", { name: "New job" }).first().click();
  await sheet.getByLabel("Customer").click();
  await page.getByRole("option", { name: "Brian Castillo" }).click();
  await sheet.getByLabel("Service", { exact: true }).fill("Water heater flush");
  await sheet.getByLabel("Price (USD)").fill("149");
  await sheet.getByLabel("Date").fill("2030-06-03");
  await sheet.getByLabel("Duration").click();
  await page.getByRole("option", { name: "2 h", exact: true }).click();
  await sheet.getByLabel("Technician").click();
  await page.getByRole("option", { name: "Alex Moreno" }).click();
  await scheduleAt("09:00");
  await expect(page.getByText("Job scheduled")).toBeVisible();

  await page.getByRole("button", { name: "New job" }).first().click();
  await sheet.getByLabel("Customer").click();
  await page.getByRole("option", { name: "Carla Nguyen" }).click();
  await sheet.getByLabel("Service", { exact: true }).fill("Faucet repair");
  await sheet.getByLabel("Price (USD)").fill("125");
  await sheet.getByLabel("Date").fill("2030-06-03");
  await sheet.getByLabel("Technician").click();
  await page.getByRole("option", { name: "Alex Moreno" }).click();
  await scheduleAt("10:00");
  await expect(
    sheet.getByText(
      /Alex Moreno already has a job from 9:00\sAM to 11:00\sAM on Mon, Jun 3, 2030/,
    ),
  ).toBeVisible();

  await scheduleAt("11:00");
  await expect(page.getByText("Job scheduled")).toBeVisible();
});
