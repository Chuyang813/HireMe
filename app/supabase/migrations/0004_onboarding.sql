-- Add onboarding fields to profiles table
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists target_role text,
  add column if not exists years_experience integer,
  add column if not exists target_industries text[],
  add column if not exists target_companies text[],
  add column if not exists onboarding_complete boolean not null default false;
