-- Local development and test users only. The hosted project gets its demo users from
-- the demo reset route. Every account uses the password in .env.example.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  email,
  extensions.crypt('local-demo-password', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
from unnest(array[
  'admin@fairview.example',
  'alex.moreno@fairview.example',
  'jenna.kowalski@fairview.example',
  'priya.shah@fairview.example',
  'tom.alvarez@fairview.example',
  'admin@lakeside.example',
  'rosa.delgado@lakeside.example'
]) as email;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  id,
  id::text,
  'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users;

select public.reset_demo_data();
