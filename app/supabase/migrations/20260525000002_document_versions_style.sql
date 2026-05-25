-- Add style column to document_versions so history entries record the generation style.
alter table public.document_versions add column if not exists style text;
