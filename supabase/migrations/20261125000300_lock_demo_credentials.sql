-- Demo accounts are shared by every visitor. Anyone signed in can call the Auth API with
-- their own session, so without this a visitor could change the demo password (or start
-- an email change) and lock everyone else out. The block lives on auth.users, below the
-- Auth API, so it holds however the change is attempted.

create function private.protect_demo_credentials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Set only inside public.set_demo_password(), which only the service role can call.
  -- Neither the Auth API nor the Data API lets a client set this parameter.
  if current_setting('serviceops.demo_credentials_unlocked', true) = 'on' then
    return new;
  end if;

  if (
    new.encrypted_password is distinct from old.encrypted_password
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or coalesce(new.email_change, '') not in ('', coalesce(old.email_change, ''))
  )
  and exists (
    select 1
    from public.organization_members m
    where m.user_id = old.id
      and m.organization_id in (
        'a0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000002'
      )
  ) then
    raise exception 'Demo account credentials cannot be changed' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_demo_credentials() from public, anon, authenticated;

create trigger protect_demo_credentials
  before update on auth.users
  for each row execute function private.protect_demo_credentials();

-- Lets the demo reset route make the configured password authoritative (for example
-- after rotating it in the environment). Only rewrites the hash when the password differs.
create function public.set_demo_password(p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_password is null or char_length(p_password) < 12 then
    raise exception 'Demo passwords must be at least 12 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where email = p_email) then
    raise exception 'Demo user % does not exist', p_email using errcode = 'P0002';
  end if;

  perform set_config('serviceops.demo_credentials_unlocked', 'on', true);
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where email = p_email
    and encrypted_password is distinct from extensions.crypt(p_password, encrypted_password);
  perform set_config('serviceops.demo_credentials_unlocked', 'off', true);
end;
$$;

revoke execute on function public.set_demo_password(text, text) from public, anon, authenticated;
grant execute on function public.set_demo_password(text, text) to service_role;
