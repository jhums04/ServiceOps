# ServiceOps

Scheduling, invoicing, and payments for small field-service businesses: customers, jobs, technician assignments, invoices, and Stripe payments in one application.

Live demo: added at deployment (Phase 4). No sign-up required: choose "Explore as administrator" or "Explore as technician". Demo data resets hourly.

## What it demonstrates

- **Scheduling conflicts prevented in the database.** A Postgres exclusion constraint rejects overlapping jobs for the same technician, including concurrent requests.
- **Authorization enforced below the UI.** Row-Level Security isolates organizations and separates administrator and technician access. Composite foreign keys make cross-organization references impossible.
- **Correct payment handling.** Stripe webhooks are signature-verified, processed idempotently, and checked against the invoice amount and currency before an invoice is marked paid. The checkout redirect never changes state.
- **Immutable invoices.** Amounts are copied at issue and protected by a trigger; editing the job afterwards does not change the invoice.
- **Tests for the cases that matter.** Permissions, isolation, scheduling, duplicate invoices, duplicate and failed webhooks, and the full customer-to-payment workflow.

## Features

- Customer records with search and job and invoice history
- Job scheduling with list and week calendar views, rescheduling, and status tracking
- Mobile-first technician workspace for today's and upcoming jobs
- Invoice generation, PDF download, and a public payment page using Stripe Checkout
- Dashboard with revenue, outstanding invoices, job counts, revenue over time, and recent activity

## Demo walkthrough

1. Sign in as administrator. Create a customer.
2. Schedule a job and assign a technician.
3. Sign in as technician. Start and complete the job.
4. Sign in as administrator. Generate the invoice and open its payment link.
5. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
6. Return to the dashboard to see the payment in revenue and the invoice marked paid.

## Architecture

A single Next.js application on Vercel with Supabase for Postgres and Auth. Server Components read with the user's session so RLS applies; Server Actions validate with Zod and write through the same session. Invariants that must hold under concurrency live in Postgres as constraints, triggers, and transactional functions. The service-role key is used only by the Stripe webhook and the demo reset endpoint.

This demo runs a single fictional merchant on one Stripe test account. Accepting payments on behalf of independent businesses would require Stripe Connect.

## Local setup

Requirements: Node 22, pnpm, Docker, Supabase CLI, Stripe CLI.

```
pnpm install
cp .env.example .env.local
pnpm db:start
pnpm db:reset
pnpm dev
```

In a second terminal, forward webhooks and copy the printed signing secret into `STRIPE_WEBHOOK_SECRET`:

```
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to localhost:3000/api/stripe/webhook
```

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Base URL for payment links and Checkout redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only: webhook and demo reset |
| `STRIPE_SECRET_KEY` | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | Demo administrator credentials |
| `DEMO_TECHNICIAN_EMAIL`, `DEMO_TECHNICIAN_PASSWORD` | Demo technician credentials |
| `DEMO_RESET_SECRET` | Bearer token for the reset endpoint |

## Tests

```
pnpm lint && pnpm typecheck
pnpm test        # unit, database, and webhook tests against local Supabase
pnpm test:e2e    # Playwright
```

CI runs all of the above on every push, plus a check that generated database types match the migrations.

## Screenshots

Added in Phase 4.
