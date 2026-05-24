# AI Engineering Upgrade TODO

This tracker turns HireMe from a full-stack LLM application into a stronger entry-level AI engineering portfolio project. Each item should leave behind code, docs, or measurable evidence.

## 1. Project Narrative And Demo Evidence

Status: Done

Goal: Make the project easy for a recruiter or AI engineering interviewer to evaluate in under five minutes.

Tasks:
- Replace the default Next.js README with a project-specific README.
- Explain the AI workflow: resume ingestion, job parsing, document generation, export, and tracking.
- Document model providers, prompt versioning, fallback behavior, and structured validation.
- Add setup instructions, required environment variables, and testing commands.
- Add a short "AI engineering highlights" section for resume/interview use.

Done when:
- `app/README.md` clearly explains what HireMe does, how to run it, and why the AI parts are engineered rather than just API calls.

## 2. AI Evaluation Harness

Status: Done

Goal: Prove that AI parsing and generation quality can be measured and compared over time.

Tasks:
- Add a small checked-in eval fixture set for job parsing and resume parsing.
- Add a local eval runner that can run with mocked expected outputs by default and optionally call live models.
- Measure JSON validity, schema validity, required field coverage, and basic hallucination/format compliance.
- Save or print a concise eval report suitable for README screenshots or interview discussion.

Done when:
- A command can run evals locally without requiring production data.
- The README explains what the evals measure and how to interpret the output.

## 3. Hallucination And Grounding Guardrails

Status: Done

Goal: Turn "never invent facts" from a prompt instruction into a code-level safety check.

Tasks:
- Add a grounding checker for generated resumes, cover letters, and email drafts.
- Flag suspicious claims such as employers, schools, certifications, links, or numeric metrics not present in the source resume/job text.
- Return warnings that the UI can display before users save or export generated documents.
- Add focused tests for false positives and obvious hallucinations.

Done when:
- Generated content can be checked against source evidence and produce actionable warnings.

## 4. Context Engineering / Retrieval

Status: Not started

Goal: Show that the app can select relevant candidate evidence instead of stuffing all context into one prompt.

Tasks:
- Extract candidate evidence from parsed resume sections.
- Match evidence against job requirements using a lightweight deterministic scorer first.
- Optionally add embeddings later if the deterministic baseline is insufficient.
- Include matched evidence in generation prompts and audit notes.

Done when:
- Document generation uses an explicit evidence selection step and can explain why certain resume bullets were emphasized.

## 5. AI-Specific Tests

Status: Not started

Goal: Increase confidence in provider behavior, parsing, and guardrail logic.

Tasks:
- Test `extractJson` on fenced JSON, noisy prose, and invalid outputs.
- Test provider fallback behavior with mocked failed/successful responses.
- Test schema validation behavior for job parsing and resume scoring.
- Test rate limiting around AI actions.
- Add tests for the grounding checker once implemented.

Done when:
- The AI layer has repeatable tests independent of Playwright UI flows.

## 6. Observability And Quality Logs

Status: Not started

Goal: Make model quality and reliability debuggable.

Tasks:
- Record latency, provider, model, prompt version, document type, and failure reason for AI requests.
- Track fallback usage and schema validation failures.
- Add a small admin/dev-facing way to inspect recent AI events.

Done when:
- A quality regression can be investigated from stored metadata rather than console logs alone.

## Working Log

- 2026-05-24: Created the AI engineering upgrade tracker and initial milestone list.
- 2026-05-24: Replaced the default Next.js README with a project-specific README covering product scope, AI workflow, provider design, validation, setup, commands, and the AI engineering roadmap.
- 2026-05-24: Added an offline AI evaluation harness with job/resume parsing fixtures, mocked model outputs, JSON extraction checks, shape validation, and expected-field accuracy reporting.
- 2026-05-24: Added a post-generation grounding checker for generated documents, persisted grounding warnings to document metadata, and surfaced review warnings in the application workspace UI.
