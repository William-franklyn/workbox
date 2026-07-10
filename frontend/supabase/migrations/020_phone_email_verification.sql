-- ============================================================
-- 020: Phone (WhatsApp) + email verification
-- Run in Supabase SQL editor.
-- ============================================================

-- One phone number can belong to only one profile
create unique index if not exists profiles_phone_number_unique
  on public.profiles (phone_number) where phone_number is not null;

alter table public.profiles add column if not exists phone_verified boolean not null default false;
alter table public.profiles add column if not exists email_verified boolean not null default false;

-- Numbers linked before verification existed were set by the account owner —
-- grandfather them so the bot keeps working for existing users.
update public.profiles set phone_verified = true where phone_number is not null;

-- One-time codes the user sends TO the WhatsApp bot ("VERIFY 123456").
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists phone_verifications_code_idx
  on public.phone_verifications (code) where used_at is null;

-- Service-role access only (webhook + API routes); no client policies.
alter table public.phone_verifications enable row level security;

-- Verification flags may only be granted by the server (service role).
-- Without this, any logged-in user could set phone_verified = true on their
-- own row through the client-side Supabase SDK and hijack the WhatsApp bot.
create or replace function public.protect_verification_flags()
returns trigger language plpgsql as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
begin
  if jwt_role <> 'service_role' then
    new.phone_verified := old.phone_verified;
    new.email_verified := old.email_verified;
    -- changing the number invalidates its verification
    if new.phone_number is distinct from old.phone_number then
      new.phone_verified := false;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_verification_flags on public.profiles;
create trigger protect_verification_flags
  before update on public.profiles
  for each row execute function public.protect_verification_flags();
