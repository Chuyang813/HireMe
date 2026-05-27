# HireMe — Agent Coding Rules (AGENTS.md)

This file defines guardrails for all AI coding agents (Claude Code, OpenAI Codex, Cursor, etc.).

## Project Structure
- `app/` — Next.js 16 frontend + API (TypeScript)
- `app/supabase/` — Supabase config and SQL migrations
- `scripts/` — Dev and CI scripts
- `docs/` — Project documentation

## Rules for All Agents

### What You Must Do
- Read existing code before writing new code
- Keep changes minimal and focused on the stated task
- Verify that functions, routes, and DB columns exist before using them
- Run `bash scripts/check.sh` after every change and fix any failures
- Report: files changed, commands run, check results, assumptions

### What You Must Not Do
- Do not modify unrelated files
- Do not create new database migrations without being asked
- Do not invent package names, API routes, or function signatures
- Do not edit existing migration files in `app/supabase/migrations/`
- Do not commit with AI co-author attribution
- Do not add debugging logs to production code

### Blocked Paths
| Path | Rule |
|------|------|
| `.env`, `.env.*` | Never read or write |
| `app/supabase/migrations/*.sql` | Never edit existing; may create new |
| `**/package-lock.json` | Only modify if dependency change is required |
| `vercel.json` | Only if deployment change is requested |

### Validation
```bash
bash scripts/check.sh
```
Must pass before any task is considered complete.

### Tech Stack Reference
- Framework: Next.js 16 App Router, TypeScript strict mode
- Database: Supabase (PostgreSQL + pgvector), RLS enabled
- AI: DeepSeek REST API (`deepseek-chat` / `deepseek-v4-pro`)
- Deployment: Vercel (Edge runtime for `/api/generate-document`)
- Styling: Tailwind CSS
- Auth: Supabase Auth
