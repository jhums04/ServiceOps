-- Spread the creation time of upcoming demo jobs over the two or three days before a
-- reset. Previously every job starting more than a few days out was stamped with the
-- reset time itself, so the dashboard's recent activity showed nothing but identical
-- "Job scheduled" rows. Only the two created_at expressions change.

create or replace function private.seed_demo_history(
  p_organization_id uuid,
  p_history_days integer,
  p_future_days integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_time_zone text;
  v_today date;
  v_technician_ids uuid[];
  v_customer_ids uuid[];
  v_services text[] := array[
    'Drain cleaning', 'Water heater flush', 'Water heater replacement', 'Faucet repair',
    'Toilet repair', 'Sump pump replacement', 'Furnace tune-up', 'AC tune-up',
    'Leak detection', 'Garbage disposal installation'
  ];
  v_descriptions text[] := array[
    'Clear slow kitchen drain and camera-inspect the line.',
    'Flush sediment from the tank and test the relief valve.',
    'Remove the old 40-gallon tank and install a 50-gallon gas unit.',
    'Replace cartridge and seals on the kitchen faucet.',
    'Replace fill valve and flapper on the upstairs toilet.',
    'Replace the failed sump pump and test the float switch.',
    'Seasonal furnace inspection, filter change, and burner cleaning.',
    'Seasonal AC inspection, coil cleaning, and refrigerant check.',
    'Locate the source of a ceiling leak below the main bathroom.',
    'Install a new 3/4 HP disposal and reconnect the dishwasher drain.'
  ];
  v_prices integer[] := array[18900, 14900, 189000, 12500, 15500, 64500, 12900, 12900, 29500, 34500];
  v_durations integer[] := array[90, 60, 240, 60, 60, 180, 90, 90, 120, 90];
  v_notes text[] := array[
    'Completed as scheduled. Customer walked through the repair.',
    'Work completed. Recommended follow-up inspection in 12 months.',
    'Completed. Replaced a worn supply line at no extra charge.',
    'Completed. Area cleaned and tested with the customer present.'
  ];
  v_invoice_count integer;
begin
  select time_zone into strict v_time_zone
  from public.organizations where id = p_organization_id;

  v_today := (now() at time zone v_time_zone)::date;

  select array_agg(id order by full_name) into v_technician_ids
  from public.organization_members
  where organization_id = p_organization_id and role = 'technician' and is_active;

  select array_agg(id order by name) into v_customer_ids
  from public.customers where organization_id = p_organization_id;

  insert into public.jobs (
    organization_id, customer_id, technician_id, service, description, price_cents,
    starts_at, ends_at, status, started_at, completed_at, completion_notes, created_at
  )
  select
    p_organization_id,
    v_customer_ids[slots.c],
    v_technician_ids[slots.t],
    v_services[slots.s],
    v_descriptions[slots.s],
    v_prices[slots.s],
    slots.starts_at,
    slots.starts_at + make_interval(mins => v_durations[slots.s]),
    slots.status,
    case when slots.status = 'completed' then slots.starts_at end,
    case when slots.status = 'completed'
      then slots.starts_at + make_interval(mins => v_durations[slots.s]) end,
    case when slots.status = 'completed'
      then v_notes[1 + (abs(slots.d) + slots.t) % array_length(v_notes, 1)] end,
    least(
      slots.starts_at - make_interval(days => 3 + (abs(slots.d) + slots.t) % 5),
      now() - make_interval(mins => 20 + (abs(slots.d) * 97 + slots.t * 41 + slots.slot * 13) % 4300)
    )
  from (
    select
      d,
      t,
      slot,
      1 + (abs(d) * 5 + t * 3 + slot * 7) % array_length(v_services, 1) as s,
      1 + (abs(d) * 7 + t * 5 + slot * 3) % array_length(v_customer_ids, 1) as c,
      ((v_today + d) + make_time(case slot when 0 then 8 else 13 end, 0, 0))
        at time zone v_time_zone as starts_at,
      case
        when d >= 0 then 'scheduled'
        when (abs(d) * 3 + t + slot) % 17 = 0 then 'cancelled'
        else 'completed'
      end::public.job_status as status
    from generate_series(-p_history_days, p_future_days) as d
    cross join generate_series(1, array_length(v_technician_ids, 1)) as t
    cross join generate_series(0, 1) as slot
    where (extract(isodow from v_today + d) <= 5 or d = 0)
      and slot < case when d >= 0 and t = 1 then 2 else (abs(d) + t) % 3 end
  ) as slots;

  -- A few upcoming jobs are left unassigned so the scheduling demo has work to assign.
  insert into public.jobs (
    organization_id, customer_id, service, description, price_cents, starts_at, ends_at,
    created_at
  )
  select
    p_organization_id,
    v_customer_ids[1 + (d * 7) % array_length(v_customer_ids, 1)],
    v_services[1 + (d * 3) % array_length(v_services, 1)],
    v_descriptions[1 + (d * 3) % array_length(v_services, 1)],
    v_prices[1 + (d * 3) % array_length(v_services, 1)],
    ((v_today + d) + time '10:00') at time zone v_time_zone,
    ((v_today + d) + time '10:00') at time zone v_time_zone
      + make_interval(mins => v_durations[1 + (d * 3) % array_length(v_services, 1)]),
    now() - make_interval(hours => 20 + d * 3)
  from generate_series(1, p_future_days) as d
  where d % 4 = 1 and extract(isodow from v_today + d) <= 5;

  -- Jobs completed more than two days ago are invoiced two hours after completion;
  -- newer ones wait for "Generate invoice". Customers pay 1 to 10 days after issue, so
  -- the most recent invoices are still open. A few are voided and a few never paid,
  -- which leaves a small number overdue.
  with invoiced as (
    select
      j.id as job_id,
      j.service,
      j.price_cents,
      (1000 + row_number() over (order by j.completed_at, j.id))::integer as number,
      j.completed_at + interval '2 hours' as issued_at
    from public.jobs j
    where j.organization_id = p_organization_id
      and j.status = 'completed'
      and j.completed_at < now() - interval '2 days'
  ),
  decided as (
    select
      invoiced.*,
      invoiced.issued_at + make_interval(days => 1 + (invoiced.number * 7) % 10) as pay_time,
      case
        when invoiced.number % 97 = 0 then 'void'
        when invoiced.number % 60 = 0 then 'unpaid'
        when invoiced.issued_at + make_interval(days => 1 + (invoiced.number * 7) % 10) < now()
          then 'paid'
        else 'unpaid'
      end::public.invoice_status as status
    from invoiced
  )
  insert into public.invoices (
    organization_id, job_id, number, line_description, amount_cents, currency, status,
    issued_at, due_on, paid_at, voided_at
  )
  select
    p_organization_id,
    job_id,
    number,
    service,
    price_cents,
    'usd',
    status,
    issued_at,
    (issued_at at time zone v_time_zone)::date + 14,
    case when status = 'paid' then pay_time end,
    case when status = 'void' then issued_at + interval '1 day' end
  from decided;

  get diagnostics v_invoice_count = row_count;

  update public.organizations
  set next_invoice_number = 1001 + v_invoice_count
  where id = p_organization_id;

  insert into public.payments (
    organization_id, invoice_id, stripe_checkout_session_id, stripe_payment_intent_id,
    amount_cents, currency, paid_at
  )
  select
    organization_id,
    id,
    'cs_test_demo_' || replace(id::text, '-', ''),
    'pi_test_demo_' || replace(id::text, '-', ''),
    amount_cents,
    currency,
    paid_at
  from public.invoices
  where organization_id = p_organization_id and status = 'paid';
end;
$$;
