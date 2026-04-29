# Application Workspace Sidebar - Multi-Perspective Debate Output

**Date**: 2026-04-28
**Topic**: Replace horizontal application workspace tabs with a sidebar navigation card.
**Roster used**: Roster 5 - Consumer product
**Rounds**: 3
**Status**: Decision document

## Executive Summary

The application detail workspace should use a left-side navigation card instead of a horizontal tab row. Each workspace section becomes a clear destination: Resume, Cover letter, Outreach email, Assessment, and Interview prep.

This mirrors the product preview on the unauthenticated landing page, making the mental model consistent before and after signup. The user sees one workspace per job, with documents and prep tasks grouped in a familiar left-to-right layout.

The interaction remains lightweight: clicking an item swaps the right-hand panel without changing the larger application page. On mobile, the left nav becomes a horizontal scrollable row inside the same card so it stays usable without adding a separate route layer.

## Decision Table

| Round | Question | Option chosen | Killed trade-off | Revisit trigger |
|---|---|---|---|---|
| 1 | Should application documents use horizontal tabs or a sidebar? | Sidebar inside a workspace card. | Slightly taller layout on small screens. | If users prefer direct URLs per section. |
| 2 | Should sidebar clicks navigate routes or switch panels in-place? | Switch panels in-place for now. | Browser history does not track each workspace section. | If users ask to share or bookmark specific sections. |
| 3 | How should completion state be shown? | Check generated document sections, leave task sections neutral. | Assessment/interview prep completion is not persisted yet. | When assessment/interview prep records get persisted and queryable. |

## Detailed Per-Round Reasoning

### Round 1 - Should application documents use horizontal tabs or a sidebar?

**P1 Product Lead**: Sidebar wins because it reinforces the "one workspace per job" concept. It makes generated materials feel like structured assets, not loose tabs.

**P2 Designer**: The sidebar matches the landing-page preview and gives the UI a stronger visual anchor. The right panel has more room for document controls and content.

**P3 Engineer**: This can be done locally in the existing client component without changing data contracts. It is a low-risk layout change.

**P4 Casual User**: A checklist-like sidebar is easier to understand than five tabs across the top.

**P5 Power User**: The faster scan pattern helps when switching among resume, email, and interview prep repeatedly.

**P6 Growth/Marketing**: Product consistency from landing page to actual app improves perceived polish.

**P7 Support**: It is easier to tell a user "click Email on the left" than describe a horizontal tab that may wrap on smaller screens.

**P8 Devil's Advocate**: Horizontal tabs are conventional and compact, but here the product metaphor benefits from a sidebar.

**Synthesis**

**Decision**: Use a sidebar workspace card.
**Reasoning**: It is more intuitive for this product and aligns with the public-facing promise.
**Killed trade-off**: More vertical height and a slightly heavier layout.
**Revisit trigger**: If mobile screenshots show the sidebar row feels cramped.

### Round 2 - Should sidebar clicks navigate routes or switch panels in-place?

**P1 Product Lead**: In-place switching is enough for beta because the user is staying in one application workspace.

**P2 Designer**: The card should feel like one surface, not multiple page loads.

**P3 Engineer**: Avoiding route changes keeps the change scoped and avoids new server/page state complexity.

**P4 Casual User**: They mainly care that clicking the item shows the matching content.

**P5 Power User**: Hash or route URLs may be useful later, but not required for current workflow.

**P6 Growth/Marketing**: Smooth switching makes the product feel faster.

**P7 Support**: In-place state is simpler, though harder to link directly.

**P8 Devil's Advocate**: Shareable section links would be nice, but they can be added after the layout proves useful.

**Synthesis**

**Decision**: Switch panels in-place.
**Reasoning**: It satisfies the immediate UX goal without adding route complexity.
**Killed trade-off**: No direct bookmarkable workspace sub-section yet.
**Revisit trigger**: If users need direct links to resume/email/interview prep sections.

### Round 3 - How should completion state be shown?

**P1 Product Lead**: Show checks where data exists, especially generated documents.

**P2 Designer**: A small check circle mirrors the landing preview without overclaiming progress.

**P3 Engineer**: Resume, cover letter, and email generation state is available from existing `application_documents`. Assessment/interview completion is not currently passed into the component.

**P4 Casual User**: A checked generated item is useful; unchecked items should not look broken.

**P5 Power User**: Completion state should eventually include assessment uploads and interview prep generation.

**P6 Growth/Marketing**: Progress indicators make the workspace feel alive.

**P7 Support**: Avoid false checks for features whose data is not loaded yet.

**P8 Devil's Advocate**: Overstating completion would erode trust, so neutral is better than fake.

**Synthesis**

**Decision**: Check only generated document sections for now.
**Reasoning**: It uses real available data and avoids false progress indicators.
**Killed trade-off**: Assessment/interview prep do not show completion yet.
**Revisit trigger**: When those records are loaded into the application page.

## Open Items / UNCERTAIN Cells

No external facts were needed. The main product uncertainty is whether users expect sidebar items to update the URL.

## Implementation Pointer

This decision drives:

- `app/src/app/(app)/applications/[id]/WorkspaceTabs.tsx`
- `app/src/app/(app)/applications/[id]/page.tsx`
- `app/messages/en.json`
- `app/messages/zh.json`
- `app/messages/fr.json`
