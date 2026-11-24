-- Business operations: job status changes, customer balances, and membership guards.

-- Status changes go through this function so technicians, who have no update privilege
-- on jobs, can start and complete their own assignments. The jobs trigger still
-- validates every transition.
create function public.update_job_status(
  p_job_id uuid,
  p_status public.job_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_organization_id uuid;
  v_role public.member_role;
  v_technician_id uuid;
begin
  select member_id, organization_id, role
  into v_member_id, v_organization_id, v_role
  from private.current_member();

  if v_member_id is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select technician_id into v_technician_id
  from public.jobs
  where id = p_job_id and organization_id = v_organization_id
  for update;

  -- Jobs a technician is not assigned to are reported as missing, not forbidden, so
  -- their existence is not revealed.
  if not found or (v_role = 'technician' and v_technician_id is distinct from v_member_id) then
    raise exception 'Job not found' using errcode = 'no_data_found';
  end if;

  if v_role = 'technician' and p_status not in ('in_progress', 'completed') then
    raise exception 'Technicians can only start and complete jobs'
      using errcode = 'insufficient_privilege';
  end if;

  update public.jobs
  set status = p_status,
      completion_notes = case
        when p_status = 'completed' then nullif(btrim(p_notes), '')
        else completion_notes
      end
  where id = p_job_id;
end;
$$;

revoke execute on function public.update_job_status(uuid, public.job_status, text)
  from public, anon;
grant execute on function public.update_job_status(uuid, public.job_status, text)
  to authenticated;

-- Customers with their outstanding balance (sum of unpaid invoices). security_invoker
-- applies the caller's RLS: technicians see no invoices, so their balances read zero.
create view public.customer_summaries
with (security_invoker = true)
as
select
  c.id,
  c.organization_id,
  c.name,
  c.email,
  c.phone,
  c.street,
  c.city,
  c.state,
  c.postal_code,
  c.created_at,
  coalesce(sum(i.amount_cents) filter (where i.status = 'unpaid'), 0)::bigint
    as outstanding_cents
from public.customers c
left join public.jobs j on j.customer_id = c.id
left join public.invoices i on i.job_id = j.id
group by c.id;

grant select on public.customer_summaries to authenticated;

create function private.protect_own_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id = auth.uid() and not new.is_active then
    raise exception 'You cannot deactivate your own account'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger protect_own_membership before update of is_active on public.organization_members
  for each row execute function private.protect_own_membership();
