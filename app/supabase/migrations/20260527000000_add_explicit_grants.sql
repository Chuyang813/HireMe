-- Explicit grants for Supabase Data API access (PostgREST / supabase-js).
-- Required for new projects from 2026-05-30, existing projects from 2026-10-30.
-- All tables already have RLS; these GRANTs allow the API layer to reach them.

GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- authenticated: full CRUD on every table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles                    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.base_resumes                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_applications            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_documents       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.application_timeline_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessment_records          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.interview_prep_records      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_versions           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_events                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_feedback           TO authenticated;

-- anon: SELECT only (RLS blocks all rows since every policy requires auth.uid())
GRANT SELECT ON TABLE public.profiles                    TO anon;
GRANT SELECT ON TABLE public.base_resumes                TO anon;
GRANT SELECT ON TABLE public.job_applications            TO anon;
GRANT SELECT ON TABLE public.application_documents       TO anon;
GRANT SELECT ON TABLE public.application_timeline_events TO anon;
GRANT SELECT ON TABLE public.assessment_records          TO anon;
GRANT SELECT ON TABLE public.interview_prep_records      TO anon;
GRANT SELECT ON TABLE public.document_versions           TO anon;
GRANT SELECT ON TABLE public.ai_events                   TO anon;
GRANT SELECT ON TABLE public.document_feedback           TO anon;

-- Future tables created in public schema automatically inherit these privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
