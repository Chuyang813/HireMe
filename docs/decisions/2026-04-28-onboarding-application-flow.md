# Onboarding and Application Flow - Multi-Perspective Debate Output

**Date**: 2026-04-28
**Topic**: Make base-resume upload the required first step, then route every user to the dashboard and guide first application creation.
**Roster used**: Roster 5 - Consumer product
**Rounds**: 3
**Status**: Decision document

## Executive Summary

The default flow should be: sign up or log in, land on dashboard, and route users without a default base resume to a single-purpose resume upload screen. After upload, return to dashboard. From there, users with no applications see a clear first-application call to action.

This keeps the product honest: generated documents need a source resume before AI can safely tailor anything. It also removes the confusing beta invite field from the visible signup path and avoids splitting new and returning users into separate mental models.

The application creation screen should explain exactly what users can paste. The URL field is for a job posting or application link that contains the job description. The text field is for the full description from LinkedIn, Indeed, a company careers page, or a school job board, including requested documents such as transcript, cover letter, portfolio, and deadlines.

## Decision Table

| Round | Question | Option chosen | Killed trade-off | Revisit trigger |
|---|---|---|---|---|
| 1 | What should the first post-auth flow be? | Require base resume before workspace use, then route to dashboard. | Users cannot explore the app before uploading a resume. | If beta testers strongly resist upload before seeing value. |
| 2 | How should users with no applications be guided? | Keep dashboard as the universal landing page and make first application the main next action. | No separate wizard for first application. | If analytics show users miss the first-application CTA. |
| 3 | What must be clarified on new application input? | Add explicit URL and text guidance in the form. | Slightly more copy on the form. | If support logs show users still paste only job titles or unrelated links. |

## Detailed Per-Round Reasoning

### Round 1 - What should the first post-auth flow be?

**Positions**

**P1 Product Lead**: Require the base resume first because it is the foundation of the product promise. Without it, document generation either fails or risks sounding generic.

**P2 Designer**: A single-purpose upload step is clearer than a three-step onboarding flow. The user understands the immediate task and the product can move them to the real workspace right after.

**P3 Engineer**: Dashboard-level gating plus server-side checks in application creation gives the simplest reliable enforcement. Keeping the action checks prevents direct-route bypasses.

**P4 Casual User**: Uploading a resume before seeing the app is a small ask if the screen explains why. It must not feel like a long setup wizard.

**P5 Power User**: Returning users should not be trapped in onboarding if they already have a resume. The default resume should be the actual gate, not a profile flag.

**P6 Growth/Marketing**: Removing visible beta invite friction makes signup feel public and normal. The cost is losing invite-code qualification in the main UI.

**P7 Support**: A required resume avoids many "why can't I generate?" tickets. It also gives a simple support answer: upload or set a default resume first.

**P8 Devil's Advocate**: This may reduce activation for curious users who want to browse first. The decision is only justified if resume-grounding is truly central.

**Synthesis**

**Decision**: Require a default base resume before app workspace use; redirect to onboarding when missing.
**Reasoning**: This aligns the product flow with the AI safety model and avoids low-quality first outputs.
**Killed trade-off**: Casual browsing before upload is de-prioritized.
**Revisit trigger**: If tester activation drops at the upload screen.

### Round 2 - How should users with no applications be guided?

**Positions**

**P1 Product Lead**: Dashboard should remain the universal landing page so new and returning users share one mental model.

**P2 Designer**: Empty dashboards need one obvious next action. The existing dashboard structure can work if the no-application state speaks directly.

**P3 Engineer**: Avoid a custom first-run route. It adds branching and state bugs.

**P4 Casual User**: "Start your first application" is clearer than stats full of zeroes.

**P5 Power User**: The dashboard is still useful later, so learning it first is good.

**P6 Growth/Marketing**: A dashboard with a visible add-application button supports demos and screenshots.

**P7 Support**: Fewer routes make troubleshooting easier.

**P8 Devil's Advocate**: A dedicated wizard might convert better, but it is premature.

**Synthesis**

**Decision**: Keep dashboard as the landing page and make the no-application state point to new application creation.
**Reasoning**: This is simpler, consistent, and enough for beta.
**Killed trade-off**: No bespoke first-run wizard.
**Revisit trigger**: If users land on dashboard and do not create an application.

### Round 3 - What must be clarified on new application input?

**Positions**

**P1 Product Lead**: The input screen must teach users what counts as useful job data.

**P2 Designer**: A small guide panel above the fields is better than long placeholder-only instructions.

**P3 Engineer**: URL fetching can fail because job boards block automated access, so text must be framed as the reliable path.

**P4 Casual User**: Examples like LinkedIn, Indeed, school job board, and company careers page remove ambiguity.

**P5 Power User**: The text box should explicitly ask for full JD, requirements, responsibilities, requested attachments, and deadlines.

**P6 Growth/Marketing**: The copy should say HireMe, not Claude, because the provider may change.

**P7 Support**: Better input guidance reduces bad AI output reports.

**P8 Devil's Advocate**: More guidance adds visual weight, but incorrect input is a bigger failure.

**Synthesis**

**Decision**: Add explicit URL and full-text guidance to the new application form.
**Reasoning**: It lowers user confusion and improves AI parsing quality without adding another step.
**Killed trade-off**: The form is slightly denser.
**Revisit trigger**: If users still submit incomplete job descriptions.

## Open Items / UNCERTAIN Cells

No external factual claims were required. The main uncertainty is behavioral: whether requiring resume upload before dashboard reduces signup completion.

## Implementation Pointer

This decision drives the current implementation in:

- `app/src/app/(app)/onboarding/page.tsx`
- `app/src/app/(app)/dashboard/page.tsx`
- `app/src/app/(app)/applications/new/page.tsx`
- `app/src/app/(app)/applications/new/NewApplicationForm.tsx`
- `app/src/app/actions/onboarding.ts`
- `app/src/app/actions/applications.ts`
- `app/src/lib/auth/actions.ts`
- `app/src/lib/auth/current-user.ts`
