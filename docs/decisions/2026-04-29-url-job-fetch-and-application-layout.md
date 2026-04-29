# Decision: URL-only job analysis and application detail layout

Date: 2026-04-29

## Debate Setup

Prompt used: `multi_perspective_debate_prompt.md`

Roster: Software architecture, shortened to the 3-round path:

1. Scope: Should URL-only application creation try to read public job pages, or require pasted JD text?
2. Trust and failure risk: What privacy, reliability, and abuse constraints apply?
3. Final consistency: What is the simplest coherent product behavior for this build?

## Round 1: Scope

Decision: Support URL-only analysis as best effort, but keep pasted JD text as the reliable fallback.

Reasoning: URL input is already present in the UI, so users naturally expect it to work. Requiring pasted text after showing a URL field creates a broken promise. The implementation should fetch readable public text, run the same parser, and return the fetched JD text to the client so the create step persists the same source material.

Killed trade-off: This does not guarantee all job boards work. LinkedIn, Indeed, school portals, and ATS pages can block automated access or render content client-side.

Revisit trigger: If more than 20-30% of closed beta URL-only attempts fail, move toward a browser extension, manual paste-first UX, or provider-backed URL context.

## Round 2: Trust And Failure Risk

Decision: Fetch only public HTTP(S) pages that pass existing safe URL validation, and do not send private user resume data to the fallback reader.

Reasoning: The page fetch path handles public job posting content only. It uses direct server fetch first, then a text reader fallback for public pages. The fallback may see the target public URL and page content, so it should not be used for private portals, authenticated links, or uploaded user documents.

Killed trade-off: A fallback reader increases reliability but introduces another external service dependency. The product still needs a clear paste fallback for blocked or private pages.

Revisit trigger: Add an allowlist/denylist or disable fallback if beta users submit sensitive internal URLs, school-authenticated postings, or if compliance requirements tighten.

## Round 3: Final Consistency

Decision: Keep the current single-page application creation flow, make URL-only populate the hidden raw JD state after analysis, and widen the detail workspace while keeping activity history in a narrow right rail.

Reasoning: This is the smallest coherent change: the backend fetches and returns the source text; the frontend saves that text; the detail page keeps the new sidebar workspace but uses a wider content container and puts History at the far end of the document toolbar.

Killed trade-off: The UI is improved for desktop width, but this is not a full redesign of the application detail page.

Revisit trigger: Recheck with a real beta user after they create three applications: one from pasted text, one from a public ATS URL, and one from a blocked job board URL.

## Follow-up Correction: Detail Page Column Ownership

Decision: The application detail page uses one parent two-column layout below the title. The left column owns both job analysis and the document workspace; the right column owns activity history.

Reasoning: Putting activity only next to the workspace made the job analysis card wider than the generation area, which visually implied that the lower workspace was cramped. Sharing one parent grid keeps the job summary and generated document area the same width.

Killed trade-off: Activity starts higher on the page beside the job summary, rather than only beside generated documents.

Revisit trigger: If the activity rail feels too visually noisy during document generation, collapse it behind a History button on medium-width screens.
