-- ============================================================
-- 025: Prevent self-privilege-escalation on profiles
-- Run in Supabase SQL editor.
--
-- SECURITY: a regular member could set their own profiles.role = 'admin'
-- (or change organization_id to hop orgs) by writing their row directly
-- with the client SDK — the RLS "update own profile" policy didn't restrict
-- WHICH columns. Verified: a member self-promoted to admin.
--
-- role and organization_id are now frozen for non-service-role updates.
-- Legitimate changes (invites, role changes) go through admin API routes,
-- which use the service role. Extends the guard from migration 020.
-- ============================================================

create or replace function public.protect_verification_flags()
returns trigger language plpgsql security definer as $$
declare
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
begin
  if jwt_role <> 'service_role' then
    -- verification flags (from migration 020)
    new.phone_verified := old.phone_verified;
    new.email_verified := old.email_verified;
    if new.phone_number is distinct from old.phone_number then
      new.phone_verified := false;
    end if;

    -- privilege / tenancy fields — only the server may change these
    new.role := old.role;
    new.organization_id := old.organization_id;
  end if;
  return new;
end $$;

drop trigger if exists protect_verification_flags on public.profiles;
create trigger protect_verification_flags
  before update on public.profiles
  for each row execute function public.protect_verification_flags();
