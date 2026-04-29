# Decision: Autosave interview prep generations

Date: 2026-04-29

## Debate Setup

Prompt used: `multi_perspective_debate_prompt.md`

Roster: Software architecture, shortened to the 3-round path:

1. Scope: Should interview prep behave like generated resume, cover letter, and email draft?
2. Trust and failure risk: What should happen if saving fails after generation succeeds?
3. Final consistency: Where should interview prep be persisted?

## Round 1: Scope

Decision: Interview prep should autosave immediately after generation, while keeping the Generate button available for regeneration.

Reasoning: Users expect generated materials inside an application workspace to persist. Resume, cover letter, and email draft already autosave; interview prep being transient would surprise users and make the activity timeline less useful.

Killed trade-off: Regeneration overwrites the current saved prep instead of requiring a separate manual save step.

Revisit trigger: If beta users want to compare multiple interview prep versions, expose the saved version history in this panel.

## Round 2: Trust And Failure Risk

Decision: If saving fails, keep the generated prep visible and show a save failure message.

Reasoning: Losing visible generated output because persistence failed would be worse than showing the result with an explicit save warning. The user can regenerate once persistence is healthy.

Killed trade-off: A failed autosave can leave the UI showing content that will not survive a refresh.

Revisit trigger: Add a manual retry save action if save failures appear in logs or beta reports.

## Round 3: Final Consistency

Decision: Store interview prep in `application_documents` as JSON text under `document_type = "interview_prep"`.

Reasoning: The document table already models generated per-application materials and has version support. Saving JSON preserves the structured question/checklist/talking-point UI without needing a new table for this MVP step.

Killed trade-off: The database stores structured data in `text_content` rather than a dedicated JSON column for interview prep.

Revisit trigger: Move interview prep to a dedicated table if users start editing individual questions, marking questions practiced, or attaching notes per question.
