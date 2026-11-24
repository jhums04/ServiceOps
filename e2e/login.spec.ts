import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("button", { name: "Explore as administrator" }),
  ).toBeVisible();
});

test("administrator demo lands on the dashboard and cannot open the technician area", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore as administrator" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/tech");
  await expect(page).toHaveURL("/dashboard");
});

test("technician demo lands on the workspace and cannot open the admin area", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore as technician" }).click();
  await expect(page).toHaveURL("/tech");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  for (const path of ["/dashboard", "/customers", "/invoices"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/tech");
  }
});

test("a wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@fairview.example");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("signing out returns to the login page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore as technician" }).click();
  await expect(page).toHaveURL("/tech");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
});
