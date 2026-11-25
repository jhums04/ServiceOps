import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import Stripe from "stripe";

import { todayInZone } from "../src/lib/dates";
import { signInAsDemo } from "./support";

const TIME_ZONE = "America/New_York";

function webhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

async function revenueCents(page: Page) {
  await page.goto("/dashboard?range=7d");
  const text = await page
    .getByRole("term")
    .filter({ hasText: "Revenue received" })
    .locator("xpath=following-sibling::dd[1]")
    .innerText();
  return Math.round(Number(text.replace(/[$,]/g, "")) * 100);
}

// Playwright does not drive the hosted Stripe Checkout page. Stripe's part ends with a
// signed checkout.session.completed event, which this test delivers itself.
test("customer to payment: schedule, assign, complete, invoice, pay, see it on the dashboard", async ({
  page,
  browser,
  request,
}) => {
  const customerName = `Workflow Customer ${randomUUID().slice(0, 8)}`;
  const today = todayInZone(TIME_ZONE);
  // Evening slot, clear of the seeded 8:00 and 13:00 jobs; a retry moves an hour later
  // so it does not collide with the job a failed attempt left behind.
  const startTime = `${18 + test.info().retry}:00`;

  await signInAsDemo(page, "administrator");
  const revenueBefore = await revenueCents(page);

  // Create the customer.
  await page.goto("/customers");
  const sheet = page.getByRole("dialog");
  await page.getByRole("button", { name: "New customer" }).first().click();
  await sheet.getByLabel("Name").fill(customerName);
  await sheet.getByLabel("Email").fill("workflow.customer@example.com");
  await sheet.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByText("Customer created")).toBeVisible();

  // Schedule an unassigned job for today.
  await page.goto("/jobs");
  await page.getByRole("button", { name: "New job" }).first().click();
  await sheet.getByLabel("Customer").click();
  await page.getByRole("option", { name: customerName }).click();
  await sheet
    .getByLabel("Service", { exact: true })
    .fill("Shutoff valve repair");
  await sheet.getByLabel("Price (USD)").fill("250");
  await sheet.getByLabel("Date").fill(today);
  await sheet.getByLabel("Start time").fill(startTime);
  await sheet.getByRole("button", { name: "Schedule job" }).click();
  await expect(page.getByText("Job scheduled")).toBeVisible();

  // Assign the technician.
  await page.goto(`/jobs?date=${today}`);
  await page.getByRole("button", { name: customerName }).click();
  await sheet.getByLabel("Technician").click();
  await page.getByRole("option", { name: "Alex Moreno" }).click();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Job updated")).toBeVisible();

  // The technician starts and completes it.
  const technicianContext = await browser.newContext();
  const technicianPage = await technicianContext.newPage();
  await signInAsDemo(technicianPage, "technician");
  await technicianPage
    .getByRole("link", { name: new RegExp(customerName) })
    .click();
  await technicianPage.getByRole("button", { name: "Start job" }).click();
  await expect(technicianPage.getByText("In progress")).toBeVisible();
  await technicianPage
    .getByLabel("Completion notes")
    .fill("Replaced the shutoff valve.");
  await technicianPage.getByRole("button", { name: "Complete job" }).click();
  await expect(
    technicianPage.getByText("Completed", { exact: true }),
  ).toBeVisible();
  await technicianContext.close();

  // The administrator generates the invoice.
  await page.goto(`/jobs?date=${today}`);
  await page.getByRole("button", { name: customerName }).click();
  await sheet.getByRole("button", { name: "Generate invoice" }).click();
  const created = page.getByText(/^Invoice \d+ created$/);
  await expect(created).toBeVisible();
  const invoiceNumber = (await created.innerText()).split(" ")[1] ?? "";

  await sheet.getByRole("link", { name: `Invoice ${invoiceNumber}` }).click();
  await expect(page).toHaveURL(/\/invoices\?invoice=/);
  const invoiceId = new URL(page.url()).searchParams.get("invoice") ?? "";
  const paymentUrl =
    (await sheet
      .getByRole("link", { name: "Open payment page" })
      .getAttribute("href")) ?? "";

  // The customer opens the public payment page without signing in.
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto(new URL(paymentUrl).pathname);
  await expect(
    customerPage.getByRole("button", { name: "Pay $250.00" }),
  ).toBeVisible();

  // Stripe reports the completed checkout.
  const payload = JSON.stringify({
    id: `evt_test_workflow_${randomUUID().replaceAll("-", "")}`,
    object: "event",
    type: "checkout.session.completed",
    api_version: "2026-11-18.endive",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: `cs_test_workflow_${randomUUID().replaceAll("-", "")}`,
        object: "checkout.session",
        payment_status: "paid",
        status: "complete",
        amount_total: 25000,
        currency: "usd",
        payment_intent: `pi_test_workflow_${randomUUID().replaceAll("-", "")}`,
        metadata: { invoice_id: invoiceId },
      },
    },
  });
  const response = await request.post("/api/stripe/webhook", {
    data: payload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret(),
      }),
    },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ received: true, outcome: "paid" });

  await customerPage.reload();
  await expect(customerPage.getByText("Paid", { exact: true })).toBeVisible();
  await customerContext.close();

  // The dashboard reflects the payment.
  expect(await revenueCents(page)).toBe(revenueBefore + 25000);
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Payment received" })
      .filter({ hasText: `Invoice ${invoiceNumber}, $250.00` })
      .filter({ hasText: customerName }),
  ).toBeVisible();

  await page.goto(`/invoices?invoice=${invoiceId}`);
  await expect(
    sheet.getByRole("term").filter({ hasText: "Paid" }),
  ).toBeVisible();
});
