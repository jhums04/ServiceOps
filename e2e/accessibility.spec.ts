import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { serviceClient, signInAsDemo } from "./support";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  expect(
    violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

async function sampleIds() {
  const service = serviceClient();
  const [customer, invoice] = await Promise.all([
    service.from("customers").select("id").order("name").limit(1).single(),
    service
      .from("invoices")
      .select("id, public_token")
      .eq("status", "unpaid")
      .order("number")
      .limit(1)
      .single(),
  ]);
  if (customer.error) throw customer.error;
  if (invoice.error) throw invoice.error;
  return { customer: customer.data, invoice: invoice.data };
}

const adminPaths = async () => {
  const { customer, invoice } = await sampleIds();
  return [
    "/dashboard",
    "/customers",
    `/customers/${customer.id}`,
    "/jobs",
    "/calendar",
    "/invoices",
    `/invoices?invoice=${invoice.id}`,
    "/employees",
  ];
};

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 375, height: 812 },
]) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("public pages", async ({ page }) => {
      const { invoice } = await sampleIds();
      for (const path of ["/login", `/pay/${invoice.public_token}`]) {
        await page.goto(path);
        await expectNoViolations(page);
        await expectNoHorizontalScroll(page);
      }
    });

    test("administrator pages", async ({ page }) => {
      await signInAsDemo(page, "administrator");
      for (const path of await adminPaths()) {
        await test.step(path, async () => {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          await expectNoViolations(page);
          await expectNoHorizontalScroll(page);
        });
      }
    });

    test("job sheet", async ({ page }) => {
      await signInAsDemo(page, "administrator");
      await page.goto("/jobs");
      await page.getByRole("button", { name: "New job" }).first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      // Colors are sampled mid slide-in otherwise.
      await sheet.evaluate((element) =>
        Promise.all(
          element.getAnimations({ subtree: true }).map((a) => a.finished),
        ),
      );
      await expectNoViolations(page);
    });

    test("technician pages", async ({ page }) => {
      await signInAsDemo(page, "technician");
      await expectNoViolations(page);
      await expectNoHorizontalScroll(page);
      await page.locator("main ul a").first().click();
      await expect(page).toHaveURL(/\/tech\/jobs\//);
      await expectNoViolations(page);
      await expectNoHorizontalScroll(page);
    });
  });
}

test("keyboard users can skip the navigation and reach every nav link", async ({
  page,
}) => {
  await signInAsDemo(page, "administrator");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  await page.goto("/dashboard");
  for (const name of [
    "Skip to content",
    "Dashboard",
    "Customers",
    "Jobs",
    "Calendar",
    "Invoices",
    "Employees",
  ]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name, exact: true })).toBeFocused();
  }
});
