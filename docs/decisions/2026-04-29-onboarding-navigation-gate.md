# Decision: Hide main navigation until base resume upload is complete

Date: 2026-04-29

## Debate Setup

Prompt used: `multi_perspective_debate_prompt.md`

Roster: Consumer product, shortened to the 3-round path:

1. Scope: Should incomplete onboarding users see the normal app navigation?
2. Trust and failure risk: What can go wrong if they navigate away before uploading a resume?
3. Final consistency: What is the simplest coherent onboarding behavior?

## Round 1: Scope

Decision: Hide the main app navigation until the user has a default base resume.

Reasoning: The product depends on a base resume for application creation, scoring, and generated documents. Showing Dashboard, Applications, Tracker, Resumes, Insights, and Settings during forced onboarding implies those areas are usable before the core setup dependency exists.

Killed trade-off: Users lose the freedom to browse the app before uploading a resume.

Revisit trigger: If closed beta users want a product tour before setup, add a read-only preview mode instead of exposing real app navigation.

## Round 2: Trust And Failure Risk

Decision: Keep language switching and sign out visible, but route the HireMe logo back to onboarding instead of dashboard.

Reasoning: Language and logout are account/session controls, not product workflows. Dashboard and other app destinations are workflow exits and should stay hidden until the resume gate is complete.

Killed trade-off: Users cannot jump to settings before uploading a resume.

Revisit trigger: If beta users need to fix account settings before onboarding, add only the specific setting inside the onboarding page.

## Round 3: Final Consistency

Decision: Make the shared app layout check for a default base resume and render a restricted header when it is missing.

Reasoning: This keeps the rule centralized instead of adding one-off hiding logic to the onboarding page. Once upload succeeds, the action creates a default resume, marks onboarding complete, and redirects to dashboard, causing the full navigation to return.

Killed trade-off: The layout performs one additional small database lookup on app pages.

Revisit trigger: If this lookup becomes a performance issue, cache onboarding status in the profile and treat the resume query as a reconciliation fallback.
