-- HireMe — initial schema
-- Tables mirror product plan §15. All PKs are uuid, timestamps are timestamptz.

create extension if not exists "pgcrypto";

-- 1. profiles: mirror of auth.users keyed by its id; lets us add app fields.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. base_resumes: user-uploaded source resumes.
create table public.base_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  source_file_path text,                -- path inside 'resumes' bucket
  source_file_type text,                -- 'pdf' | 'docx' | 'txt'
  raw_text text,                        -- extracted text, if any
  parsed_resume_json jsonb,             -- structured parse (may be null until parse completes)
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index base_resumes_user_idx on public.base_resumes (user_id);
create unique index base_resumes_one_default_per_user
  on public.base_resumes (user_id) where is_default;

-- 3. application status enum
create type public.application_status as enum (
  'saved',
  'ready_to_apply',
  'applied',
  'assessment',
  'interview',
  'rejected',
  'offer',
  'withdrawn'
);

-- 4. job_applications: one row per job the user is pursuing.
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  base_resume_id uuid references public.base_resumes (id) on delete set null,
  company_name text,
  role_title text,
  location text,
  job_url text,
  raw_job_text text,
  parsed_job_json jsonb,
  current_status public.application_status not null default 'saved',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_applications_user_idx on public.job_applications (user_id);
create index job_applications_status_idx on public.job_applications (user_id, current_status);

-- 5. document type enum
create type public.document_type as enum (
  'tailored_resume',
  'cover_letter',
  'email_draft',
  'assessment_notes',
  'interview_prep'
);

-- 6. application_documents: versioned generated artifacts per application.
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type public.document_type not null,
  version integer not null default 1,
  title text,
  storage_path text,                    -- optional: file in 'documents' bucket
  text_content text,                    -- primary body
  metadata_json jsonb,
  created_at timestamptz not null default now()
);

create index application_documents_app_idx
  on public.application_documents (application_id, document_type, version desc);

-- 7. timeline event type enum
create type public.timeline_event_type as enum (
  'created',
  'status_changed',
  'document_generated',
  'assessment_added',
  'interview_prep_generated',
  'note_added'
);

-- 8. application_timeline_events: audit trail for each application.
create table public.application_timeline_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type public.timeline_event_type not null,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz not null default now()
);

create index application_timeline_events_app_idx
  on public.application_timeline_events (application_id, created_at desc);

-- 9. assessment_records
create table public.assessment_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_text text,
  source_file_path text,
  analysis_json jsonb,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessment_records_app_idx on public.assessment_records (application_id);

-- 10. interview_prep_records
create table public.interview_prep_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  interview_stage text,
  generated_questions_json jsonb,
  preparation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index interview_prep_records_app_idx on public.interview_prep_records (application_id);

-- 11. updated_at trigger function (reused)
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.tg_set_updated_at();

create trigger set_updated_at_base_resumes
before update on public.base_resumes
for each row execute function public.tg_set_updated_at();

create trigger set_updated_at_job_applications
before update on public.job_applications
for each row execute function public.tg_set_updated_at();

create trigger set_updated_at_assessment_records
before update on public.assessment_records
for each row execute function public.tg_set_updated_at();

create trigger set_updated_at_interview_prep_records
before update on public.interview_prep_records
for each row execute function public.tg_set_updated_at();

-- 12. auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
