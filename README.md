# HireMe

AI-powered job application assistant — tailored resumes, cover letters, interview prep, and outreach emails.

Built with Next.js 16, Supabase, and DeepSeek.

## Agent Coding Harness

This project uses a structured guardrail system for AI coding agents (Claude Code, Codex, Cursor, etc.).

- **CLAUDE.md** — Rules and project context for Claude Code
- **AGENTS.md** — Rules for all AI coding agents (Codex, Cursor, etc.)
- **scripts/check.sh** — Validation script that runs lint, type checking, build, and tests

All AI-generated code changes must pass `bash scripts/check.sh` before being accepted. The guardrails prevent hallucinated APIs, unintended file modifications, and broken builds.
