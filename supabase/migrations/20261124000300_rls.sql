-- Privileges and Row-Level Security (SPEC section 5).

-- Start from nothing: Supabase grants every client role full access to new objects in
-- public by default. Each privilege below is granted deliberately.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
-- Functions are executable by PUBLIC by default; only a global default can undo that.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Security definer so policies on organization_members can call it without recursing.
create function private.current_member()
returns table (member_id uuid, organization_id uuid, role public.member_role)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.organization_id, m.role
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.is_active;
$$;

revoke execute on function private.current_member() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_member() to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_webhook_events enable row level security;

-- Column grants keep identifiers, ownership, roles, and lifecycle timestamps out of
-- reach of clients; policies then decide which rows.
grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant update (full_name, phone, is_active) on public.organization_members to authenticated;
grant select on public.customers to authenticated;
grant insert (organization_id, name, email, phone, street, city, state, postal_code)
  on public.customers to authenticated;
grant update (name, email, phone, street, city, state, postal_code)
  on public.customers to authenticated;
grant select on public.jobs to authenticated;
grant insert (
  organization_id, customer_id, technician_id, service, description, price_cents, starts_at, ends_at
) on public.jobs to authenticated;
grant update (
  customer_id, technician_id, service, description, price_cents, starts_at, ends_at, status,
  completion_notes
) on public.jobs to authenticated;
grant select on public.invoices to authenticated;
grant select on public.payments to authenticated;

-- Policy subqueries are wrapped in (select ...) so Postgres evaluates them once per
-- statement instead of once per row.

create policy "Members read their organization"
  on public.organizations for select to authenticated
  using (id = (select organization_id from private.current_member()));

create policy "Members read members of their organization"
  on public.organization_members for select to authenticated
  using (organization_id = (select organization_id from private.current_member()));

create policy "Admins update members of their organization"
  on public.organization_members for update to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  )
  with check (organization_id = (select organization_id from private.current_member()));

create policy "Admins read customers of their organization"
  on public.customers for select to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  );

create policy "Technicians read customers of their assigned jobs"
  on public.customers for select to authenticated
  using (
    (select role from private.current_member()) = 'technician'
    and exists (
      select 1
      from public.jobs j
      where j.customer_id = customers.id
        and j.technician_id = (select member_id from private.current_member())
    )
  );

create policy "Admins create customers in their organization"
  on public.customers for insert to authenticated
  with check (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  );

create policy "Admins update customers of their organization"
  on public.customers for update to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  )
  with check (organization_id = (select organization_id from private.current_member()));

create policy "Admins read jobs of their organization"
  on public.jobs for select to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  );

create policy "Technicians read their assigned jobs"
  on public.jobs for select to authenticated
  using (
    (select role from private.current_member()) = 'technician'
    and technician_id = (select member_id from private.current_member())
  );

create policy "Admins create jobs in their organization"
  on public.jobs for insert to authenticated
  with check (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  );

create policy "Admins update jobs of their organization"
  on public.jobs for update to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  )
  with check (organization_id = (select organization_id from private.current_member()));

create policy "Admins read invoices of their organization"
  on public.invoices for select to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  );

create policy "Admins read payments of their organization"
  on public.payments for select to authenticated
  using (
    (select role from private.current_member()) = 'admin'
    and organization_id = (select organization_id from private.current_member())
  );

-- stripe_webhook_events has RLS enabled, no grants, and no policies: only the service
-- role can reach it.
