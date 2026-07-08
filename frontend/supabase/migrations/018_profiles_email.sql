-- 018: profiles.email — the live table predates migration 000 and lacks it.
-- Several routes depend on it: member invites (lookup by email), CSV import
-- (assignee resolution), Stripe checkout (customer email).

alter table profiles add column if not exists email text;

-- Backfill from auth.users
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

create index if not exists idx_profiles_email on profiles(email);

-- Keep it populated for future signups (same trigger migration 000 defines;
-- recreated here in case the live DB never had it).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email
    where profiles.email is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
