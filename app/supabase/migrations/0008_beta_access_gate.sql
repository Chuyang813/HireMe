alter table public.profiles
  add column if not exists beta_approved boolean not null default false;

update public.profiles
set beta_approved = true
where beta_approved = false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, beta_approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'beta_invite_ok')::boolean, false)
  );
  return new;
end $$;

