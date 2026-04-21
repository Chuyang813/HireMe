-- HireMe — private storage buckets for user files.
-- Path convention: {auth.uid()}/{filename}. RLS enforces user_id match via path prefix.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('assessments', 'assessments', false)
on conflict (id) do nothing;

-- storage.objects has its own RLS; owner must equal auth.uid()
-- and path must start with the user's uid folder.
create policy "resumes_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "assessments_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'assessments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'assessments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
