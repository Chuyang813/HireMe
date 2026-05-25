-- Existing Gemini embeddings are 768 dimensions and cannot be reused with
-- DeepSeek's 1536-dimensional embedding model.
update base_resumes set embedding = null where embedding is not null;
update job_applications set jd_embedding = null where jd_embedding is not null;

-- Drop old indexes before changing vector dimensions.
drop index if exists base_resumes_embedding_idx;
drop index if exists job_applications_jd_embedding_idx;
drop index if exists resumes_embedding_idx;

-- Change vector dimensions from Gemini's 768 to DeepSeek's 1536.
alter table base_resumes
  alter column embedding type vector(1536) using null;

alter table job_applications
  alter column jd_embedding type vector(1536) using null;

-- Recreate indexes for 1536 dimensions.
create index if not exists base_resumes_embedding_idx
  on base_resumes using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists job_applications_jd_embedding_idx
  on job_applications using ivfflat (jd_embedding vector_cosine_ops) with (lists = 100);
