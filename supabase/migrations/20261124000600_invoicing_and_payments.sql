-- Invoice generation, voiding, the public invoice lookup, and payment recording.

-- Invoices are written only through these functions; clients have select only.
create function public.create_invoice(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_role public.member_role;
  v_job public.jobs;
  v_time_zone text;
  v_number integer;
  v_invoice_id uuid;
begin
  select organization_id, role into v_organization_id, v_role from private.current_member();
  if v_role is distinct from 'admin' then
    raise exception 'Only administrators can generate invoices'
      using errcode = 'insufficient_privilege';
  end if;

  -- Locking the job serializes concurrent generation; the partial unique index on
  -- invoices(job_id) is what finally rejects the second invoice.
  select * into v_job
  from public.jobs
  where id = p_job_id and organization_id = v_organization_id
  for update;
  if not found then
    raise exception 'Job not found' using errcode = 'no_data_found';
  end if;

  if v_job.status <> 'completed' then
    raise exception 'Only completed jobs can be invoiced' using errcode = 'check_violation';
  end if;
  if v_job.price_cents <= 0 then
    raise exception 'Jobs priced at $0.00 cannot be invoiced' using errcode = 'check_violation';
  end if;

  -- The organization row lock makes numbering gapless and sequential; a failed insert
  -- rolls the increment back with it.
  update public.organizations
  set next_invoice_number = next_invoice_number + 1
  where id = v_organization_id
  returning next_invoice_number - 1, time_zone into v_number, v_time_zone;

  insert into public.invoices (
    organization_id, job_id, number, line_description, amount_cents, currency, due_on
  )
  values (
    v_organization_id,
    v_job.id,
    v_number,
    v_job.service,
    v_job.price_cents,
    'usd',
    (now() at time zone v_time_zone)::date + 14
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

create function public.void_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_role public.member_role;
  v_status public.invoice_status;
begin
  select organization_id, role into v_organization_id, v_role from private.current_member();
  if v_role is distinct from 'admin' then
    raise exception 'Only administrators can void invoices'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_status
  from public.invoices
  where id = p_invoice_id and organization_id = v_organization_id
  for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'no_data_found';
  end if;
  if v_status <> 'unpaid' then
    raise exception 'Only unpaid invoices can be voided' using errcode = 'check_violation';
  end if;

  update public.invoices set status = 'void' where id = p_invoice_id;
end;
$$;

-- The payment page is public and addressed only by the unguessable token, so it reads
-- through this function instead of a table policy. It returns only what the page, the
-- PDF, and Checkout need.
create function public.get_public_invoice(p_token text)
returns table (
  id uuid,
  number integer,
  status public.invoice_status,
  line_description text,
  amount_cents integer,
  currency text,
  issued_at timestamptz,
  due_on date,
  paid_at timestamptz,
  organization_name text,
  organization_time_zone text,
  customer_name text,
  customer_email text,
  customer_street text,
  customer_city text,
  customer_state text,
  customer_postal_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.number,
    i.status,
    i.line_description,
    i.amount_cents,
    i.currency,
    i.issued_at,
    i.due_on,
    i.paid_at,
    o.name,
    o.time_zone,
    c.name,
    c.email,
    c.street,
    c.city,
    c.state,
    c.postal_code
  from public.invoices i
  join public.organizations o on o.id = i.organization_id
  join public.jobs j on j.id = i.job_id
  join public.customers c on c.id = j.customer_id
  where p_token ~ '^[0-9a-f]{64}$'
    and i.public_token = p_token;
$$;

-- Called only by the Stripe webhook, after signature verification. Returns what
-- happened so the webhook can log it. Every outcome, including mismatches, marks the
-- event processed so a retried delivery is never applied twice.
create function public.record_stripe_payment(
  p_event_id text,
  p_event_type text,
  p_invoice_id uuid,
  p_checkout_session_id text,
  p_payment_status text,
  p_amount_cents integer default null,
  p_currency text default null,
  p_payment_intent_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  insert into public.stripe_webhook_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  if p_payment_status is distinct from 'paid' then
    return 'not_paid';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    return 'invoice_not_found';
  end if;
  if v_invoice.status <> 'unpaid' then
    return 'invoice_not_payable';
  end if;
  if p_amount_cents is distinct from v_invoice.amount_cents
    or p_currency is distinct from v_invoice.currency
  then
    return 'amount_mismatch';
  end if;

  insert into public.payments (
    organization_id, invoice_id, stripe_checkout_session_id, stripe_payment_intent_id,
    amount_cents, currency, paid_at
  )
  values (
    v_invoice.organization_id, v_invoice.id, p_checkout_session_id, p_payment_intent_id,
    p_amount_cents, p_currency, now()
  );

  update public.invoices set status = 'paid', paid_at = now() where id = v_invoice.id;
  return 'paid';
end;
$$;

revoke execute on function public.create_invoice(uuid) from public, anon;
grant execute on function public.create_invoice(uuid) to authenticated;

revoke execute on function public.void_invoice(uuid) from public, anon;
grant execute on function public.void_invoice(uuid) to authenticated;

revoke execute on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated;

revoke execute on function public.record_stripe_payment(
  text, text, uuid, text, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.record_stripe_payment(
  text, text, uuid, text, text, integer, text, text
) to service_role;
