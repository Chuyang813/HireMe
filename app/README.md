# HireMe

HireMe is an AI-powered job application assistant that helps candidates upload a base resume, parse job postings, generate role-specific application materials, and track each opportunity in a secure workspace.

The project is built as a full-stack TypeScript application with Next.js, Supabase, and multiple LLM provider paths. It is intended to demonstrate practical AI product engineering: structured outputs, prompt/version auditability, provider fallback, document ingestion, and user-data isolation.

## What It Does

- Upload PDF, DOCX, or TXT resumes and extract plain text for downstream AI workflows.
- Parse job descriptions into structured fields such as company, role, location, required skills, desired skills, application method, and deadline.
- Generate tailored resumes, cover letters, email drafts, interview prep, and assessment analysis from a candidate resume plus a target role.
- Save generated documents with version history and export application materials as PDF or DOCX.
- Track each job application in a job-specific workspace with status, timeline events, notes, and generated artifacts.
- Support English, Chinese, and French interface copy with `next-intl`.

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Server Actions, Route Handlers, Server Components |
| Auth and database | Supabase Auth, PostgreSQL, Row Level Security |
| File storage | Supabase Storage |
| AI providers | Gemini primary path, optional GLM fallback, Anthropic backup helpers |
| AI validation | Zod schemas, prompt versioning, model/provider audit notes |
| Document parsing | Gemini PDF extraction, `unpdf` fallback, `mammoth` for DOCX |
| Export | `docx`, `jspdf` |
| Quality | ESLint, Playwright E2E |

## AI Workflow

1. Resume ingestion: uploaded resumes are converted into raw text through format-specific extractors in `src/lib/parsers/resume-text.ts`.
2. Structured parsing: resume and job text are converted into typed JSON objects by LLM prompts plus Zod schemas in `src/lib/ai`.
3. Context assembly: server actions load the user's default parsed resume and the selected parsed job posting.
4. Generation: document-specific prompts produce tailored resumes, cover letters, email drafts, interview prep, or assessment notes.
5. Validation and audit: structured outputs are schema-checked where applicable, and generated timeline events include provider, model, and prompt version metadata.
6. Persistence: generated documents can be saved, versioned, restored, and exported.

## AI Engineering Highlights

- Provider abstraction: `src/lib/ai/provider.ts` centralizes Gemini and GLM generation paths with timeout handling, retryable failure handling, fallback chains, and response extraction.
- Prompt traceability: generation events record `provider`, `model`, and `prompt_version` so output quality can be debugged later.
- Structured output handling: parsing and scoring flows use Zod schemas to reduce runtime failures from malformed model JSON.
- Upload resilience: PDF parsing first uses Gemini document understanding when configured, then falls back to `unpdf` for text-based PDFs.
- Safety-oriented prompts: resume and cover-letter prompts explicitly prohibit fabricated employers, schools, dates, titles, degrees, certifications, metrics, and accomplishments.
- Post-generation grounding checks: saved generated documents are scanned for unsupported emails, links, metrics, dates, and named entities, with warnings persisted to document metadata and shown in the workspace.
- Product security: private user data is protected with server-side auth checks, Supabase RLS, storage policies, safe redirects, request limits, and HTML sanitization.

## Current AI Engineering Roadmap

The next upgrades are tracked in `../docs/ai-engineering-todo.md`.

Priority improvements:

- Add an AI evaluation harness for parser accuracy, schema validity, format compliance, and hallucination checks.
- Expand post-generation grounding checks with richer source attribution and lower false-positive rates.
- Add AI-specific unit tests for JSON extraction, provider fallback behavior, schema validation, and rate limiting.
- Add a lightweight evidence-selection step before generation so prompts emphasize the most relevant resume bullets for each job.
- Store richer observability metadata such as latency, failure reason, fallback usage, and validation failures.

## Local Setup

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Fill in the Supabase and AI provider values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run lint
npm run test:unit
npm run eval:ai
npm run build
npm run test:e2e
```

`npm run eval:ai` runs the offline AI evaluation harness in `evals/`. It uses checked-in fixtures and mocked model outputs, so it does not require API keys or production user data. The current report measures JSON validity, schema shape validity, and expected-field accuracy for job and resume parsing tasks.

## Project Structure

```text
src/app
  Route groups, pages, Server Actions, and API routes.

src/lib/ai
  Provider abstraction, prompts, parsers, schemas, and document generators.

src/lib/auth
  Current-user helpers, auth actions, and safe redirect handling.

src/lib/security
  Request limits, rate limiting, HTML sanitization, and request helpers.

src/lib/parsers
  Resume file text extraction.

supabase/migrations
  Database schema, RLS policies, storage setup, and beta access gate.

e2e
  Playwright smoke and auth tests.
```

## Portfolio Talking Point

HireMe is not just a wrapper around a model endpoint. The project handles private user data, document ingestion, typed AI outputs, provider reliability, generation auditability, multi-tenant access control, and end-user workflows around saving, versioning, and exporting AI-generated materials.
