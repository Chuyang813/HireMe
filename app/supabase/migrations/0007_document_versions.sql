-- Document version history: snapshots of text_content saved before each overwrite.
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.application_documents (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index document_versions_doc_idx
  on public.document_versions (document_id, created_at desc);

alter table public.document_versions enable row level security;

-- Users may only access versions for documents they own.
create policy "Users own their document versions" on public.document_versions
  for all using (
    exists (
      select 1 from public.application_documents d
      where d.id = document_versions.document_id
        and d.user_id = auth.uid()
    )
  );
