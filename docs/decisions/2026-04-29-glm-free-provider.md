# Decision: Add GLM free models as the primary beta AI provider

Date: 2026-04-29

## Debate Setup

Prompt used: `multi_perspective_debate_prompt.md`

Roster: Software architecture, shortened to the 3-round path:

1. Scope: Should the beta use GLM free models before the account is funded?
2. Trust and failure risk: What happens if GLM free capacity is overloaded?
3. Final consistency: How should provider fallback work without deleting Claude backup code?

## Round 1: Scope

Decision: Add GLM as the preferred provider when `GLM_API_KEY` or `ZAI_API_KEY` is present, using free text models by default.

Reasoning: Z.AI documents `GLM-4.7-Flash` and `GLM-4.5-Flash` as free text models, and the API is OpenAI-compatible enough to fit the current provider abstraction. This lets beta testing continue without paid GLM balance while preserving a path to paid GLM models later.

Killed trade-off: Free models may be weaker or more congested than paid GLM models.

Revisit trigger: Switch `GLM_MODEL` to a paid model such as `glm-4.5-air` after the account is funded and writing quality becomes the limiting factor.

## Round 2: Trust And Failure Risk

Decision: Default to `glm-4.5-flash`, then try `glm-4.7-flash`, then fall back to Gemini.

Reasoning: Local smoke testing showed `glm-4.7-flash` can return temporary 429 overload, while `glm-4.5-flash` completed both plain text and JSON calls. The code keeps the better-known GLM free model available as fallback without adding a slow failed attempt first on every request.

Killed trade-off: The default may not be the highest-quality free GLM model.

Revisit trigger: If `glm-4.7-flash` becomes consistently available, set `GLM_MODEL=glm-4.7-flash` in the environment.

## Round 3: Final Consistency

Decision: Keep Gemini PDF extraction and Claude backup code unchanged, while routing normal `aiText` and `aiJson` calls through GLM first.

Reasoning: The existing PDF extraction path depends on Gemini inline PDF support. Most product generation paths are text-only and can use GLM immediately. Claude remains intentionally untouched as backup code, per project requirement.

Killed trade-off: The provider layer now has more branching logic than the previous Gemini-only implementation.

Revisit trigger: Introduce a provider registry and usage logging table once paid GLM is enabled or when beta usage needs cost accounting.

## Billing Note

Z.AI documentation indicates paid API usage consumes account balance and may be suspended when balance is insufficient. Error documentation lists `429 Account balance exhausted`. Subscription products can auto-renew through a linked payment method, but normal paid API calls should be treated as balance-based rather than invisible month-end debt.
