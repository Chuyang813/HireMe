-- HireMe — Row-Level Security policies.
-- Every row must be owned by the user_id column (or profiles.id) that equals auth.uid().
-- Plan §13.4 requires strict per-user isolation.

alter table public.profiles                      enable row level security;
alter table public.base_resumes                  enable row level security;
alter table public.job_applications              enable row level security;
alter table public.application_documents         enable row level security;
alter table public.application_timeline_events   enable row level security;
alter table public.assessment_records            enable row level security;
alter table public.interview_prep_records        enable row level security;

-- profiles
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- base_resumes
create policy "resumes_owner_all" on public.base_resumes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- job_applications
create policy "applications_owner_all" on public.job_applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- application_documents
create policy "documents_owner_all" on public.application_documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- application_timeline_events
create policy "timeline_owner_all" on public.application_timeline_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- assessment_records
create policy "assessment_owner_all" on public.assessment_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- interview_prep_records
create policy "interview_prep_owner_all" on public.interview_prep_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
