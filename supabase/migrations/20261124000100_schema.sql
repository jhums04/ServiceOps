-- Core schema: extensions, enums, tables, constraints, and indexes (SPEC section 4).

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Helpers used by RLS policies and triggers. Not exposed through the Data API.
create schema private;
revoke all on schema private from public;

create type public.member_role as enum ('admin', 'technician');
create type public.job_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.invoice_status as enum ('unpaid', 'paid', 'void');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  time_zone text not null,
  next_invoice_number integer not null default 1001 check (next_invoice_number > 0),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null unique references auth.users (id),
  role public.member_role not null,
  full_name text not null check (char_length(full_name) between 1 and 200),
  phone text check (char_length(phone) <= 50),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(name) between 1 and 200),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 50),
  street text check (char_length(street) <= 200),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 100),
  postal_code text check (char_length(postal_code) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index customers_organization_id_name_idx on public.customers (organization_id, name);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  customer_id uuid not null,
  technician_id uuid,
  service text not null check (char_length(service) between 1 and 200),
  description text check (char_length(description) <= 2000),
  price_cents integer not null check (price_cents >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.job_status not null default 'scheduled',
  completion_notes text check (char_length(completion_notes) <= 2000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers (organization_id, id),
  foreign key (organization_id, technician_id) references public.organization_members (organization_id, id),
  constraint jobs_time_range_check check (ends_at > starts_at),
  constraint jobs_assigned_before_start_check
    check (status in ('scheduled', 'cancelled') or technician_id is not null),
  constraint jobs_started_at_check
    check (status in ('scheduled', 'cancelled') or started_at is not null),
  constraint jobs_completed_at_check check ((status = 'completed') = (completed_at is not null)),
  -- A technician cannot hold two active jobs whose time ranges overlap. tstzrange is
  -- half-open ([)), so back-to-back jobs do not conflict.
  constraint jobs_technician_overlap_excl exclude using gist (
    technician_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('scheduled', 'in_progress'))
);

create index jobs_organization_id_starts_at_idx on public.jobs (organization_id, starts_at);
create index jobs_technician_id_starts_at_idx on public.jobs (technician_id, starts_at);
create index jobs_customer_id_idx on public.jobs (customer_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  number integer not null check (number > 0),
  line_description text not null check (char_length(line_description) between 1 and 2000),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  status public.invoice_status not null default 'unpaid',
  public_token text not null unique
    default encode(extensions.gen_random_bytes(32), 'hex')
    check (public_token ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  due_on date not null,
  paid_at timestamptz,
  voided_at timestamptz,
  unique (organization_id, number),
  unique (organization_id, id),
  foreign key (organization_id, job_id) references public.jobs (organization_id, id),
  constraint invoices_paid_at_check check ((status = 'paid') = (paid_at is not null)),
  constraint invoices_voided_at_check check ((status = 'void') = (voided_at is not null))
);

create unique index invoices_job_id_active_key on public.invoices (job_id) where status <> 'void';
create index invoices_organization_id_status_idx on public.invoices (organization_id, status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null unique,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'usd'),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id)
);

create index payments_organization_id_paid_at_idx on public.payments (organization_id, paid_at);

create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
