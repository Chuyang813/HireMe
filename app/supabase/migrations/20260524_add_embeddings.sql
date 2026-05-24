create extension if not exists vector;
alter table base_resumes add column if not exists embedding vector(768);
alter table job_applications add column if not exists jd_embedding vector(768);
create index if not exists base_resumes_embedding_idx on base_resumes using ivfflat (embedding vector_cosine_ops) with (lists = 100);
