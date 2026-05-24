create table if not exists document_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references application_documents(id) on delete cascade,
  feedback_type text not null,
  rating      smallint not null check (rating in (-1, 1)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists document_feedback_user_doc_type_idx
  on document_feedback (user_id, document_id, feedback_type);

alter table document_feedback enable row level security;

create policy "Users manage their own feedback"
  on document_feedback
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
