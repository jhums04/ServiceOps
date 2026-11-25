-- Dashboard aggregates, the activity feed, and per-organization row caps (SPEC sections
-- 2 Dashboard, 4 Views/Functions/Triggers, 9 abuse limits).

-- Ranges are calendar dates in the organization's time zone, [p_from, p_to). The functions
-- run as the caller so RLS still applies; the role check gives a clear error instead of
-- silently returning only what a technician can see.
create function public.dashboard_summary(p_from date, p_to date)
returns table (
  revenue_cents bigint,
  payment_count integer,
  outstanding_cents bigint,
  outstanding_count integer,
  overdue_count integer,
  upcoming_jobs integer,
  completed_jobs integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_member record;
  v_time_zone text;
  v_from timestamptz;
  v_to timestamptz;
  v_today date;
begin
  select * into v_member from private.current_member();
  if v_member.role is distinct from 'admin' then
    raise exception 'Only administrators can view the dashboard' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;

  select time_zone into strict v_time_zone
  from public.organizations where id = v_member.organization_id;

  v_from := p_from::timestamp at time zone v_time_zone;
  v_to := p_to::timestamp at time zone v_time_zone;
  v_today := (now() at time zone v_time_zone)::date;

  return query
  select
    coalesce(p.revenue_cents, 0)::bigint,
    coalesce(p.payment_count, 0)::integer,
    coalesce(i.outstanding_cents, 0)::bigint,
    coalesce(i.outstanding_count, 0)::integer,
    coalesce(i.overdue_count, 0)::integer,
    coalesce(u.upcoming_jobs, 0)::integer,
    coalesce(c.completed_jobs, 0)::integer
  from
    (
      select sum(amount_cents) as revenue_cents, count(*) as payment_count
      from public.payments
      where organization_id = v_member.organization_id
        and paid_at >= v_from and paid_at < v_to
    ) as p,
    (
      select
        sum(amount_cents) as outstanding_cents,
        count(*) as outstanding_count,
        count(*) filter (where due_on < v_today) as overdue_count
      from public.invoices
      where organization_id = v_member.organization_id and status = 'unpaid'
    ) as i,
    (
      select count(*) as upcoming_jobs
      from public.jobs
      where organization_id = v_member.organization_id
        and status = 'scheduled'
        and starts_at >= now() and starts_at < now() + interval '7 days'
    ) as u,
    (
      select count(*) as completed_jobs
      from public.jobs
      where organization_id = v_member.organization_id
        and status = 'completed'
        and completed_at >= v_from and completed_at < v_to
    ) as c;
end;
$$;

-- Every bucket in the range is returned, including empty ones, so the chart has no gaps.
-- bucket_start is the first calendar day of the bucket in the organization's time zone.
create function public.revenue_series(p_from date, p_to date, p_bucket text)
returns table (bucket_start date, revenue_cents bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_member record;
  v_time_zone text;
  v_step interval;
begin
  select * into v_member from private.current_member();
  if v_member.role is distinct from 'admin' then
    raise exception 'Only administrators can view the dashboard' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;
  if p_bucket = 'day' then
    v_step := interval '1 day';
  elsif p_bucket = 'month' then
    v_step := interval '1 month';
  else
    raise exception 'Bucket must be day or month' using errcode = '22023';
  end if;

  select time_zone into strict v_time_zone
  from public.organizations where id = v_member.organization_id;

  return query
  with buckets as (
    select generate_series(
      date_trunc(p_bucket, p_from::timestamp),
      (p_to - 1)::timestamp,
      v_step
    )::date as bucket_start
  ),
  totals as (
    select
      date_trunc(p_bucket, paid_at at time zone v_time_zone)::date as bucket_start,
      sum(amount_cents) as revenue_cents
    from public.payments
    where organization_id = v_member.organization_id
      and paid_at >= (p_from::timestamp at time zone v_time_zone)
      and paid_at < (p_to::timestamp at time zone v_time_zone)
    group by 1
  )
  select b.bucket_start, coalesce(t.revenue_cents, 0)::bigint
  from buckets b
  left join totals t using (bucket_start)
  order by b.bucket_start;
end;
$$;

revoke execute on function public.dashboard_summary(date, date) from public, anon;
revoke execute on function public.revenue_series(date, date, text) from public, anon;
grant execute on function public.dashboard_summary(date, date) to authenticated;
grant execute on function public.revenue_series(date, date, text) to authenticated;

create view public.activity_feed
with (security_invoker = true)
as
select
  j.organization_id,
  'job_scheduled'::text as kind,
  j.created_at as occurred_at,
  j.id as job_id,
  null::uuid as invoice_id,
  j.service,
  c.name as customer_name,
  null::integer as invoice_number,
  null::integer as amount_cents
from public.jobs j
join public.customers c on c.id = j.customer_id
union all
select
  j.organization_id,
  'job_completed',
  j.completed_at,
  j.id,
  null,
  j.service,
  c.name,
  null,
  null
from public.jobs j
join public.customers c on c.id = j.customer_id
where j.completed_at is not null
union all
select
  i.organization_id,
  'invoice_issued',
  i.issued_at,
  i.job_id,
  i.id,
  i.line_description,
  c.name,
  i.number,
  i.amount_cents
from public.invoices i
join public.jobs j on j.id = i.job_id
join public.customers c on c.id = j.customer_id
union all
select
  p.organization_id,
  'payment_received',
  p.paid_at,
  i.job_id,
  i.id,
  i.line_description,
  c.name,
  i.number,
  p.amount_cents
from public.payments p
join public.invoices i on i.id = p.invoice_id
join public.jobs j on j.id = i.job_id
join public.customers c on c.id = j.customer_id;

grant select on public.activity_feed to authenticated;

-- Demo abuse limit. Statement-level so a bulk insert (the demo reset) counts once. The
-- advisory lock serializes concurrent inserts per organization and table; each count
-- then runs on a fresh snapshot that includes every committed row, so two sessions
-- cannot both slip under the cap.
create function private.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit constant integer := tg_argv[0]::integer;
  v_organization_id uuid;
  v_count integer;
begin
  for v_organization_id in
    select distinct organization_id from new_rows order by organization_id
  loop
    perform pg_advisory_xact_lock(hashtext(tg_table_name), hashtext(v_organization_id::text));
    execute format('select count(*) from public.%I where organization_id = $1', tg_table_name)
      into v_count
      using v_organization_id;
    if v_count > v_limit then
      raise exception 'This demo organization has reached its limit of % %. The demo resets every hour.',
        v_limit, tg_table_name
        using errcode = 'program_limit_exceeded';
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function private.enforce_row_cap() from public, anon, authenticated;

create trigger customers_row_cap
  after insert on public.customers
  referencing new table as new_rows
  for each statement execute function private.enforce_row_cap('100');

create trigger jobs_row_cap
  after insert on public.jobs
  referencing new table as new_rows
  for each statement execute function private.enforce_row_cap('1000');
