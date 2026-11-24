-- Demo data. reset_demo_data() deletes and regenerates every business row of the two
-- demo organizations. All dates are relative to the moment of the reset, and every
-- value is derived arithmetically (no random()) so dashboard figures can be checked by
-- hand. Auth users must already exist: supabase/seed.sql creates them locally, the demo
-- reset route restores them on the hosted project.

create function private.upsert_demo_member(
  p_organization_id uuid,
  p_email text,
  p_role public.member_role,
  p_full_name text,
  p_phone text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'Demo user % does not exist', p_email;
  end if;

  insert into public.organization_members (organization_id, user_id, role, full_name, phone)
  values (p_organization_id, v_user_id, p_role, p_full_name, p_phone)
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role,
        full_name = excluded.full_name,
        phone = excluded.phone,
        is_active = true;
end;
$$;

-- Weekday schedule for each technician: up to two jobs a day in an 8:00 and a 13:00
-- slot (organization time), so active jobs never overlap. Past jobs are completed or
-- cancelled, today and future jobs are scheduled. The first technician by name always
-- has two jobs on every upcoming day, including today, for the technician demo.
create function private.seed_demo_history(
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
    least(slots.starts_at - make_interval(days => 3 + (abs(slots.d) + slots.t) % 5), now())
  from (
    select
      d,
      t,
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
    now() - interval '1 day'
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

create function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fairview_id constant uuid := 'a0000000-0000-4000-8000-000000000001';
  v_lakeside_id constant uuid := 'a0000000-0000-4000-8000-000000000002';
begin
  -- Two overlapping resets would interleave deletes and inserts.
  perform pg_advisory_xact_lock(hashtext('public.reset_demo_data'));

  delete from public.payments where organization_id in (v_fairview_id, v_lakeside_id);
  delete from public.invoices where organization_id in (v_fairview_id, v_lakeside_id);
  delete from public.jobs where organization_id in (v_fairview_id, v_lakeside_id);
  delete from public.customers where organization_id in (v_fairview_id, v_lakeside_id);

  insert into public.organizations (id, name, time_zone, next_invoice_number)
  values
    (v_fairview_id, 'Fairview Plumbing & Heating', 'America/New_York', 1001),
    (v_lakeside_id, 'Lakeside Plumbing Co.', 'America/Chicago', 1001)
  on conflict (id) do update
    set name = excluded.name,
        time_zone = excluded.time_zone,
        next_invoice_number = excluded.next_invoice_number;

  perform private.upsert_demo_member(
    v_fairview_id, 'admin@fairview.example', 'admin', 'Dana Whitfield', '(614) 555-0100');
  perform private.upsert_demo_member(
    v_fairview_id, 'alex.moreno@fairview.example', 'technician', 'Alex Moreno', '(614) 555-0151');
  perform private.upsert_demo_member(
    v_fairview_id, 'jenna.kowalski@fairview.example', 'technician', 'Jenna Kowalski', '(614) 555-0152');
  perform private.upsert_demo_member(
    v_fairview_id, 'priya.shah@fairview.example', 'technician', 'Priya Shah', '(614) 555-0153');
  perform private.upsert_demo_member(
    v_fairview_id, 'tom.alvarez@fairview.example', 'technician', 'Tom Alvarez', '(614) 555-0154');
  perform private.upsert_demo_member(
    v_lakeside_id, 'admin@lakeside.example', 'admin', 'Owen Brooks', '(608) 555-0100');
  perform private.upsert_demo_member(
    v_lakeside_id, 'rosa.delgado@lakeside.example', 'technician', 'Rosa Delgado', '(608) 555-0151');

  insert into public.customers (organization_id, name, email, phone, street, city, state, postal_code)
  values
    (v_fairview_id, 'Alicia Bennett', 'alicia.bennett@example.com', '(614) 555-0111', '1432 Oakland Park Ave', 'Columbus', 'OH', '43224'),
    (v_fairview_id, 'Brian Castillo', 'brian.castillo@example.com', '(614) 555-0112', '88 E Lane Ave', 'Columbus', 'OH', '43201'),
    (v_fairview_id, 'Carla Nguyen', 'carla.nguyen@example.com', '(614) 555-0113', '2210 Bethel Rd', 'Columbus', 'OH', '43220'),
    (v_fairview_id, 'Derek Foster', 'derek.foster@example.com', '(614) 555-0114', '515 S Grant Ave', 'Columbus', 'OH', '43215'),
    (v_fairview_id, 'Elena Rossi', 'elena.rossi@example.com', '(614) 555-0115', '761 Mohawk St', 'Columbus', 'OH', '43206'),
    (v_fairview_id, 'Frank Okafor', 'frank.okafor@example.com', '(614) 555-0116', '4120 Kenny Rd', 'Columbus', 'OH', '43220'),
    (v_fairview_id, 'Grace Lindqvist', 'grace.lindqvist@example.com', '(614) 555-0117', '39 W Kanawha Ave', 'Columbus', 'OH', '43214'),
    (v_fairview_id, 'Hassan Malik', 'hassan.malik@example.com', '(614) 555-0118', '1875 Northwest Blvd', 'Columbus', 'OH', '43212'),
    (v_fairview_id, 'Ivy Thompson', 'ivy.thompson@example.com', '(614) 555-0119', '6650 Riverside Dr', 'Dublin', 'OH', '43017'),
    (v_fairview_id, 'Jamal Wright', 'jamal.wright@example.com', '(614) 555-0120', '102 N State St', 'Westerville', 'OH', '43081'),
    (v_fairview_id, 'Katherine Doyle', 'katherine.doyle@example.com', '(614) 555-0121', '2984 Dublin Granville Rd', 'Columbus', 'OH', '43235'),
    (v_fairview_id, 'Luis Ortega', 'luis.ortega@example.com', '(614) 555-0122', '1340 Grandview Ave', 'Grandview Heights', 'OH', '43212'),
    (v_lakeside_id, 'Megan Albrecht', 'megan.albrecht@example.com', '(608) 555-0111', '214 Jenifer St', 'Madison', 'WI', '53703'),
    (v_lakeside_id, 'Nate Halvorsen', 'nate.halvorsen@example.com', '(608) 555-0112', '1810 Monroe St', 'Madison', 'WI', '53711'),
    (v_lakeside_id, 'Olivia Pham', 'olivia.pham@example.com', '(608) 555-0113', '4402 Regent St', 'Madison', 'WI', '53705');

  perform private.seed_demo_history(v_fairview_id, 182, 14);
  perform private.seed_demo_history(v_lakeside_id, 60, 7);
end;
$$;

revoke execute on function private.upsert_demo_member(uuid, text, public.member_role, text, text)
  from public, anon, authenticated;
revoke execute on function private.seed_demo_history(uuid, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.reset_demo_data() to service_role;
