-- Row-level rules that must hold for every writer, including direct Data API calls.

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.jobs
  for each row execute function private.set_updated_at();

-- The composite foreign key keeps the technician in the job's organization; this keeps
-- an administrator or a deactivated member from being assigned.
create function private.check_job_technician()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.technician_id is not null
    and (tg_op = 'INSERT' or new.technician_id is distinct from old.technician_id)
    and not exists (
      select 1
      from public.organization_members m
      where m.id = new.technician_id
        and m.role = 'technician'
        and m.is_active
    )
  then
    raise exception 'Assigned member must be an active technician'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_job_technician before insert or update of technician_id on public.jobs
  for each row execute function private.check_job_technician();

create function private.enforce_job_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id or new.created_at <> old.created_at then
    raise exception 'Job organization and creation time cannot change'
      using errcode = 'check_violation';
  end if;

  if (old.status <> 'scheduled' or new.status <> 'scheduled')
    and (
      new.starts_at <> old.starts_at
      or new.ends_at <> old.ends_at
      or new.technician_id is distinct from old.technician_id
      or new.customer_id <> old.customer_id
    )
  then
    raise exception 'Only scheduled jobs can be rescheduled or reassigned'
      using errcode = 'check_violation';
  end if;

  -- Lifecycle timestamps are owned by this trigger, never by the caller.
  new.started_at := old.started_at;
  new.completed_at := old.completed_at;

  if new.status <> old.status then
    if not (
      (old.status = 'scheduled' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Job status cannot change from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status = 'in_progress' then
      new.started_at := now();
    elsif new.status = 'completed' then
      new.completed_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_job_update before update on public.jobs
  for each row execute function private.enforce_job_update();

create function private.enforce_invoice_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id
    or new.job_id <> old.job_id
    or new.number <> old.number
    or new.line_description <> old.line_description
    or new.amount_cents <> old.amount_cents
    or new.currency <> old.currency
    or new.public_token <> old.public_token
    or new.issued_at <> old.issued_at
    or new.due_on <> old.due_on
  then
    raise exception 'Issued invoices are immutable'
      using errcode = 'check_violation';
  end if;

  if new.status = old.status then
    new.paid_at := old.paid_at;
    new.voided_at := old.voided_at;
    return new;
  end if;

  if old.status <> 'unpaid' then
    raise exception 'Invoice status cannot change from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
    new.voided_at := null;
  else
    new.voided_at := now();
    new.paid_at := null;
  end if;

  return new;
end;
$$;

create trigger enforce_invoice_update before update on public.invoices
  for each row execute function private.enforce_invoice_update();
