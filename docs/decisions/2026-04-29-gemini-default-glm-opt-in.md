# Decision: Restore Gemini as default and make GLM opt-in

Date: 2026-04-29

## Debate Setup

Prompt used: `multi_perspective_debate_prompt.md`

Roster: Software architecture, shortened to the 3-round path:

1. Scope: Should free GLM remain the default provider after slow/error-prone testing?
2. Trust and failure risk: What provider behavior is least surprising during beta?
3. Final consistency: How should GLM remain available for future paid/beta usage?

## Round 1: Scope

Decision: Restore Gemini as the default provider.

Reasoning: Free GLM testing showed slow responses and transient errors. The current product needs predictable generation more than experimental free-model routing.

Killed trade-off: The app may use Gemini quota sooner unless the project has enough free Gemini allocation.

Revisit trigger: Revisit when GLM account balance is funded and a paid model such as `glm-4.5-air` is available.

## Round 2: Trust And Failure Risk

Decision: Do not use GLM as a fallback unless explicitly enabled.

Reasoning: A fallback that is slower and error-prone can turn one provider failure into a longer visible wait for the user. Fallbacks should improve reliability, not extend failure latency.

Killed trade-off: Some Gemini failures will no longer automatically try GLM free models.

Revisit trigger: Enable `ENABLE_GLM_FALLBACK=true` only after GLM paid-model latency and error rates are acceptable.

## Round 3: Final Consistency

Decision: Keep GLM provider code, but require `AI_PROVIDER=glm` to make it primary.

Reasoning: This preserves the future path for paid GLM and beta-exclusive model routing without affecting normal users today. Claude backup code remains untouched.

Killed trade-off: Provider selection is now environment-driven, so deployment configuration matters.

Revisit trigger: Add per-user or per-plan provider routing when beta/paid tiers are introduced.
