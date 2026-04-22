-- HireMe — cross-user document association protection.
-- Replaces the broad "documents_owner_all" policy with split policies so that
-- INSERT is also validated against job_applications ownership, preventing a
-- user from associating a document with another user's application.

drop policy if exists "documents_owner_all" on public.application_documents;

-- SELECT, UPDATE, DELETE: row must belong to the authenticated user.
create policy "documents_select_own" on public.application_documents
  for select using (user_id = auth.uid());

create policy "documents_update_own" on public.application_documents
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "documents_delete_own" on public.application_documents
  for delete using (user_id = auth.uid());

-- INSERT: user_id must match the caller AND the referenced application must
-- also belong to the caller, preventing cross-user document association.
create policy "documents_insert_own" on public.application_documents
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.job_applications
      where id = application_id
        and user_id = auth.uid()
    )
  );
