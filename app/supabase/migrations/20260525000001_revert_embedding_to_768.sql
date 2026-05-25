drop index if exists resumes_embedding_idx;
drop index if exists base_resumes_embedding_idx;
drop index if exists job_applications_jd_embedding_idx;
alter table base_resumes alter column embedding type vector(768) using null;
alter table job_applications alter column jd_embedding type vector(768) using null;
create index resumes_embedding_idx on base_resumes using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index job_applications_jd_embedding_idx on job_applications using ivfflat (jd_embedding vector_cosine_ops) with (lists = 100);
