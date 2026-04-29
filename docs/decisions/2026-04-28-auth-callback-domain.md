# Auth Callback Domain - Multi-Perspective Debate Output

**Date**: 2026-04-28
**Topic**: Fix signup verification links after changing the production domain.
**Roster used**: Roster 2 - Software architecture
**Rounds**: 3
**Status**: Decision document

## Executive Summary

Signup verification links depend on both the app callback URL and Supabase Auth URL configuration. The code should not break when the public Vercel domain changes, so the app now derives the callback URL from `NEXT_PUBLIC_APP_URL` when configured, otherwise from the current request origin.

Supabase remains the authority that sends the email and verifies redirect URLs. Its Auth URL configuration still must include the production domain and callback path; otherwise generated links can fall back to the old site URL such as `http://localhost:3000`.

This keeps the app robust for future domain changes while preserving the existing `/auth/callback` exchange flow.

## Decision Table

| Round | Question | Option chosen | Killed trade-off | Revisit trigger |
|---|---|---|---|---|
| 1 | Should callback URL depend only on env? | Use env first, then current request origin. | Slightly more server-action logic. | If multiple tenant domains are introduced. |
| 2 | Should Supabase URL config be changed in code? | No, it must be changed in Supabase project settings. | Cannot fully automate without a management token. | If a Supabase management token is added. |
| 3 | Should old domains stay allowed? | Keep localhost for dev and add the new production callback in Supabase. | Broader redirect allowlist. | If public launch requires stricter domain hygiene. |

## Detailed Per-Round Reasoning

### Round 1 - Should callback URL depend only on env?

**Decision**: Prefer `NEXT_PUBLIC_APP_URL`, fallback to request origin.
**Reasoning**: This fixes empty or stale environment variables while keeping explicit env support.
**Killed trade-off**: More logic in auth actions.
**Revisit trigger**: If the product supports multiple custom domains.

### Round 2 - Should Supabase URL config be changed in code?

**Decision**: Leave Supabase project settings as an operator step.
**Reasoning**: Service-role keys can manage app data but not project Auth URL settings.
**Killed trade-off**: One manual dashboard step remains.
**Revisit trigger**: If a Supabase management token is safely configured.

### Round 3 - Should old domains stay allowed?

**Decision**: Keep local development URLs and add the new production callback.
**Reasoning**: Local testing still needs `localhost`, while production verification needs the public domain.
**Killed trade-off**: The allowlist has more than one URL.
**Revisit trigger**: Before broader public launch.

## Open Items / UNCERTAIN Cells

Supabase Dashboard Auth URL settings need to be updated manually to include `https://hireme87.vercel.app/auth/callback` and set the Site URL to `https://hireme87.vercel.app`.

## Implementation Pointer

This decision drives:

- `app/src/lib/auth/actions.ts`
