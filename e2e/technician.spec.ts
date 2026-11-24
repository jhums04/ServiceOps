import { expect, test } from "@playwright/test";

import { signInAsDemo } from "./support";

test.use({ viewport: { width: 375, height: 812 } });

test("a technician starts and completes today's job on a phone-sized screen", async ({
  page,
}) => {
  await signInAsDemo(page, "technician");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  await page.locator("main ul a").first().click();
  await page.getByRole("button", { name: "Start job" }).click();
  await expect(page.getByText("In progress")).toBeVisible();

  await page
    .getByLabel("Completion notes")
    .fill("Replaced the cartridge. No leaks.");
  await page.getByRole("button", { name: "Complete job" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Replaced the cartridge. No leaks."),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
