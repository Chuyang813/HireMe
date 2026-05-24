# HireMe Implementation Checklist

Execution-ready checklist for improving security, reliability, product quality, and AI governance.

## 1) Critical Security Fixes (P0)

- [x] Fix open redirect in login flow (`next` parameter must allow safe internal paths only).
- [x] Validate `job_url` scheme before rendering links (allow only `http`/`https`).
- [x] Prevent cross-user record association at DB level for `application_documents`.
- [x] Replace raw internal error exposure with generic user-safe errors.

## 2) Data and Access Controls (P0-P1)

- [ ] Verify RLS policies with multi-user isolation tests.
- [ ] Redact PII from logs (resume text, emails, sensitive content).
- [ ] Add account data export and deletion workflows.
- [ ] Ensure storage bucket policies match table-level ownership boundaries.

## 3) AI Reliability and Quality (P1)

- [x] Add request timeouts for all AI calls.
- [x] Add bounded retries with backoff for transient provider failures.
- [ ] Add idempotency keys for generation endpoints.
- [x] Add post-generation non-fabrication checks.
- [x] Enforce schema validation for structured AI outputs.
- [x] Version prompts and model configurations for traceability.

## 4) Product and UX Improvements (P1-P2)

- [ ] Provide editable parsed resume fields before generation.
- [x] Provide editable parsed job fields before generation.
- [x] Improve document version management (history/restore).
- [ ] Add action-driven dashboard widgets (next steps, due items).
- [x] Improve PDF/DOCX export formatting quality.

## 5) Engineering Quality and Ops (P1)

- [x] Add E2E smoke tests for landing, auth, and protected-route redirects.
- [ ] Add API contract tests for core server actions/routes.
- [x] Add observability (error tracking + latency/success metrics).
- [x] Add per-user rate limiting on generation/upload endpoints.
- [ ] Define staged rollout and rollback procedure.

## 6) Documentation Alignment (P1)

- [ ] Align product plan architecture with implemented stack.
- [ ] Clarify MVP boundary vs post-MVP features consistently across sections.
- [ ] Add explicit security/compliance section (RLS, logging, retention, deletion).
- [x] Add AI governance references to `AI_AGENT_POLICY.md`.

## 7) Suggested Execution Order (2 Weeks)

- [x] Day 1-2: Complete all P0 security fixes.
- [ ] Day 3-5: Add DB integrity checks + RLS verification + key tests.
- [ ] Day 6-8: Implement AI reliability guardrails.
- [x] Day 9-12: UX improvements for parse-edit-generate flow.
- [ ] Day 13-14: Documentation sync, pre-release validation, staging signoff.

## Definition of Done

- [ ] All P0 items completed and verified in staging.
- [ ] No high-severity security findings remain open.
- [x] Core AI policy constraints are implemented and testable.
- [x] E2E smoke flow is green locally.
- [ ] Product plan and implementation state are aligned.
