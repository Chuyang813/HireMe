# Reset Test Data and Worktree Cleanup - Multi-Perspective Debate Output

**Date**: 2026-04-28
**Topic**: Clear Supabase test data and remove unrelated dirty files before a fresh product test.
**Roster used**: Roster 2 - Software architecture
**Rounds**: 3
**Status**: Decision document

## Executive Summary

The safest reset path is to clear user-owned runtime data while preserving schema, migrations, app code, and environment configuration. That means deleting auth users, public user/application rows, generated document rows, timeline rows, and storage objects in app-owned buckets.

The worktree cleanup should remove generated local worktrees and temporary scratch files, while keeping durable process files. `multi_perspective_debate_prompt.md` is not disposable because the project now depends on it as the required post-change review process, so it should be tracked rather than deleted.

Root-level deleted files that are no longer part of the deployed app can be committed as deletions. The actual Next.js app continues to live under `app/`, with its own `package.json` and lockfile.

## Decision Table

| Round | Question | Option chosen | Killed trade-off | Revisit trigger |
|---|---|---|---|---|
| 1 | How should test data be reset? | Delete app runtime data through Supabase admin APIs, preserve schema. | Does not test migrations from scratch. | If schema drift becomes the issue under test. |
| 2 | Which dirty files should be removed? | Remove generated worktrees and scratch files; commit obsolete tracked root deletions. | Some local notes are discarded. | If those notes become needed for documentation. |
| 3 | What happens to the debate prompt file? | Track it as a project process artifact. | Adds a non-code root document. | If the process moves into docs or a formal agent policy file. |

## Detailed Per-Round Reasoning

### Round 1 - How should test data be reset?

**Decision**: Clear auth users, public user data tables, timeline/document/application rows, and storage objects while keeping schema intact.
**Reasoning**: This matches the user's goal: retest the product flow from a clean account without risking migrations, policies, or table definitions.
**Killed trade-off**: This is not a full database rebuild.
**Revisit trigger**: If testing needs to validate migrations or seed state.

### Round 2 - Which dirty files should be removed?

**Decision**: Delete generated `.claude/worktrees`, scratch status/reset files, and untracked Supabase local config; commit deletion of obsolete root package/screenshot files.
**Reasoning**: These files are unrelated to the active Next.js app and were already dirty before this task.
**Killed trade-off**: Local scratch notes are gone.
**Revisit trigger**: If project status notes should become formal docs.

### Round 3 - What happens to the debate prompt file?

**Decision**: Track `multi_perspective_debate_prompt.md`.
**Reasoning**: The user explicitly made this part of the default workflow, so leaving it untracked would keep the worktree dirty and risk losing the process instruction.
**Killed trade-off**: The repository now includes a process prompt at the root.
**Revisit trigger**: If it gets moved under `docs/` later.

## Open Items / UNCERTAIN Cells

No external facts were needed. The reset was performed against the Supabase project configured in local environment variables.

## Implementation Pointer

This decision covers:

- Supabase runtime data reset
- Removal of generated local dirty files
- Tracking `multi_perspective_debate_prompt.md`
- Committing deletion of obsolete root-level tracked files
