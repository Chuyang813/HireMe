@AGENTS.md

# HireMe — AI Agent Coding Guide

## Project Overview
HireMe is a Next.js 16 App Router application (in `app/`) that helps job seekers generate tailored resumes, cover letters, interview prep, and outreach emails using AI (DeepSeek via REST API). Backend logic uses Supabase (PostgreSQL + pgvector + Storage) with Row Level Security. Deployment is via Vercel.

**Key directories:**
- `app/src/app/` — Next.js pages and API routes
- `app/src/app/api/` — API route handlers (Edge runtime)
- `app/src/app/actions/` — Server Actions
- `app/src/lib/ai/` — AI logic (embeddings, BM25, evidence, harnesses)
- `app/src/components/` — Shared UI components
- `app/supabase/migrations/` — SQL migrations (DO NOT MODIFY without explicit instruction)

## Agent Rules

### Code Changes
- Make small, focused changes. One logical change per task.
- Do not modify files unrelated to the task.
- Search the repo before creating a new function — it may already exist.
- Do not invent API endpoints, database columns, package names, or function signatures that don't exist. Verify first.
- Do not add `console.log` debugging statements to production code.

### Blocked Files (do not modify unless explicitly instructed)
- `.env`, `.env.*`, `.env.local`
- `app/supabase/migrations/**` (create NEW migration files; never edit existing ones)
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `docker-compose*.yml`
- `vercel.json` (unless deployment config change is the explicit goal)

### Before Committing
Always run the validation script and ensure it passes:
```bash
bash scripts/check.sh
```

### Commit Rules
- NEVER add "Co-Authored-By" trailers to commit messages
- NEVER add any AI attribution to commits
- The only author on all commits must be the repository owner

### Final Response Format
Every task response must include:
1. **Files changed** — list every file modified/created/deleted
2. **Commands run** — every shell command executed
3. **Check results** — output of `bash scripts/check.sh`
4. **Risks/assumptions** — anything uncertain or requiring human review
