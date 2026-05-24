-- AI request observability without storing prompt or generated content.

create table if not exists public.ai_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.job_applications(id) on delete set null,
  event_type text not null,
  provider text,
  model text,
  prompt_version text,
  document_type text,
  latency_ms integer,
  success boolean not null default false,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_events enable row level security;

drop policy if exists "Users can read own ai events" on public.ai_events;
create policy "Users can read own ai events"
  on public.ai_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ai events" on public.ai_events;
create policy "Users can insert own ai events"
  on public.ai_events for insert
  with check (auth.uid() = user_id);

create index if not exists ai_events_user_created_idx
  on public.ai_events(user_id, created_at desc);

create index if not exists ai_events_application_created_idx
  on public.ai_events(application_id, created_at desc);
