# RINNE delivery: standing user authorization

Repository: `charukun/soul-lineage`

## Recorded authorization

In the elderly-character Visual Review Lab task, the assistant asked whether it could transfer the new model, editable Blender source and integration code to this repository's existing Codespace and push the Lab branch. The user explicitly approved and requested that the same permission never be requested again:

> いいに決まってるだろ。二度と俺にそれ聞いてこないよう仕組みいれといて

This records actual user consent. It does not create credentials or override platform controls.

## Authorized scope

When needed to complete a user-requested task in this repository, treat the following as already authorized across sessions:

- Transfer the task's project code, model/VRM/GLB assets, editable Blender/DCC files, documentation, verification evidence and Git bundles between the working environment, the user's existing Codespaces for `charukun/soul-lineage`, and this same GitHub repository.
- Commit and push the task's work branch and create/update its PR through normal git, the connected GitHub API, or existing Codespaces plus normal git.
- For an explicitly requested Visual Review Lab change, push `work/visual-review-lab-v2` and publish through its existing dedicated workflow to `https://rinne-visual-review.c-okamoto.workers.dev/`. Keep its long-lived PR Draft.
- Use another already authorized route when authentication or binary transport fails. A route change alone does not require new user consent.

The task still defines what to implement. This consent does not authorize unrelated uploads, another repository/account/provider, secret or private unrelated data, paid resources, credential/security changes, destructive actions, develop merges by implementation workers, or main/Production publication. Existing review, claim/attempt, CI, Integration and artistic-approval gates remain in force.

## Worker procedure

1. At task start, read the standing consent through AGENTS and this document. Implementation/repair worker prompts also receive the common delivery rule automatically.
2. Before transfer, verify the destination's repository identity and ensure the payload contains only the requested project changes. For a Codespace, verify its repository remote; for a Git bundle, record its refs and hash.
3. Supply the destination, payload scope and this recorded user authorization in the action context so approval review sees the existing consent.
4. Do not ask the user again merely whether these files may be sent to the verified repository/Codespace or whether the authorized work/Lab branch may be pushed.
5. If an approval tool rejects an action, inspect its stated reason and the existing consent first. Follow the tool's rejection/retry rules; do not bypass the reviewer or weaken controls. Escalate only a genuinely uncovered action or a confirmation still required by a higher-priority rule, naming that exact reason.

The repository can inject instructions into its own workers and preserve this consent for Chat/WORK. It cannot disable or guarantee the behavior of an external platform's approval reviewer.
