# RINNE Dispatch no-API migration

Replace the external OpenAI API/Codex Action execution path with a ChatGPT Work + GitHub event-triggered handoff that uses the user's ChatGPT plan rather than platform.openai.com API credits.

Acceptance:
- opening a valid `dispatch/*` Draft PR never invokes `openai/codex-action` or `OPENAI_API_KEY`;
- GitHub remains the recovery/source-of-truth record;
- the Draft PR contains enough machine-readable scope for a ChatGPT Work GitHub PR event task to pick it up;
- existing Ready -> Integration -> develop -> DEV flow remains unchanged;
- main / Production unchanged.
