# Integration Deep Repair Handoff

Fast Laneは通常Ready PRの唯一のmerge入口であり、Fast RepairはGitで機械的に安全なmerge-forwardだけを処理する。

Fast Laneが真のmerge conflictまたはlarge-base reconciliationを検出した場合、旧Rescue queueや1時間watchdogを通常の起動条件にせず、そのcurrent exact headに対するDeep Repair handoffを同じIntegration passで即時に記録する。

## Repository側の即時handoff

Deep Repair handoffは次を満たす。

- GitHub current stateだけを正本にし、PR番号、branch、exact head、current develop、reasonを固定する。
- `integration/deep-repair` statusと `integration-deep-repair:v1` machine-readable Issueを即時に作る。
- Issueには既存 `rinne-ai-repair:v1` envelopeも含め、既存Work repair契約と同じ座標・安全条件を渡す。
- exact headごとの `sourceKey` で冪等化し、同じheadをFast Laneが再評価してもIssueを重複生成しない。
- explicit hold、Changes requested、未解決thread、未merge dependency、external PR、main / Productionを自動修復へ送らない。
- Deep Repair自身はmerge権限を持たない。元PR branchをfast-forwardで修復し、fast validation後に同じFast Laneへ戻す。
- OpenAI API、Codex Action、専用PAT、有料fallbackを通常Deep Repair起動条件に追加しない。
- 旧periodic Work/watchdogは取りこぼし復旧のfallbackとして残してよいが、Deep Repair要求の発見や状態生成を担当しない。

Fast Repair可能な `behind` / dependency追従は従来どおり軽量executorで処理し、Deep Repair Issueを作らない。

## ChatGPT Work GitHub event trigger

Repository codeはChatGPTアカウント/ProjectのWork event trigger自体を登録できない。Browser self-healingと同じく、Repositoryは安全なmachine-readable GitHub eventを作り、ChatGPT側のevent triggerがそれをclaimする。

`charukun/soul-lineage` の GitHub Issue opened/edited eventに対し、次の条件のWork triggerを1つ設定する。

- Issue body contains `<!-- integration-deep-repair:v1`
- parsed state is exactly `pending`
- `attempt < maxAttempts`
- Issue is open
- repository is exactly `charukun/soul-lineage`

Work prompt:

```text
You are the Integration Deep Repair worker for charukun/soul-lineage.

Read latest develop, AGENTS.md, docs/DEVELOPMENT.md, docs/INTEGRATION.md, docs/INTEGRATION_RECONCILIATION.md and docs/INTEGRATION_DEEP_REPAIR.md. Treat current GitHub state as canonical.

The triggering GitHub Issue contains an integration-deep-repair:v1 JSON block and a rinne-ai-repair:v1 envelope. Re-read the Issue and source PR before acting. Continue only if the issue is open, state=pending, attempt<maxAttempts, the PR is open/non-Draft/develop/same-repository, and the PR exact head still matches the recorded head.

Claim this Issue before editing by changing state from pending to working, incrementing attempt by one, and setting claimedBy/claimedAt. If the Issue or PR is no longer eligible, mark the Issue stale or human-required as appropriate and stop without changing code.

Repair the existing PR branch only. Re-read current develop and both sides of every true conflict. Preserve both intents when compatible. Never resolve by unconditional ours/theirs, never clear integration holds or review objections, never weaken tests/browser/Production gates, never force-push, and never modify main/Production.

For contract/control/assertion-sensitive conflicts, read the governing Repository sources and only proceed when compatibility and gate preservation can be demonstrated without a product decision. Otherwise mark human-required with the exact decision needed.

Run the repository fast validation against the current develop baseline. Push only the validated repair to the same source PR branch. After push, update the Issue state so normal CI/Fast Lane owns re-evaluation. Do not merge the PR yourself unless explicitly assigned Integration.

The worker ends after repair, fast validation and push. It does not wait for CI/browser/DEV. Browser and DEV repair remain independent asynchronous lanes.
```

このtriggerはPRごとに独立Issueを受け取れるため、ChatGPT Work側が並列セッションを許す範囲で複数Deep Repairを並列実行できる。同じexact headは1 Issueだけで、各Workは自分のsource PR branchだけを変更する。関連PR同士が並行して進んでも、Fast Laneのcurrent develop/head再読、overlap review、expected-head mergeが最終fenceになる。

Repository側はWorkの実行完了を待たず、Deep Repair Issue発行後も次のReady PRを評価し続ける。Work側のアカウント同時実行上限が低い場合はWork側で待ち行列になるが、Integration Fast Laneを停止させない。

## browser / DEVとの並列性

Browser smokeはFast Laneと並行して走り、失敗は `browser-repair:v1` Issueへ送る。Browser Work repairはIssue単位でclaimし、最大attempt内で同じPR/repair branchを修復する。browserが赤でも独立Ready PRのmerge laneは停止しない。

DEV publicationは各Fast Lane pass後に最新develop SHAへ明示dispatchされ、古いautomatic publisherをcancel/coalesceする。公開中にさらにPRがmergeされた場合は新しいdevelop SHAのpublisherが優先され、古いDEV publish完了を待ってから次PRをmergeする構成にはしない。

## 受入条件

1. 真のconflictを検出したFast Lane passが、同じexact headへ一度だけDeep Repair Issue/statusを作る。
2. 同じheadを再評価してもIssueを重複生成しない。
3. headが変わった場合は新しいexact headとして再評価する。
4. Fast Repair可能なbehind/stack更新はDeep Repairへ送らない。
5. Deep Repair要求中でも他のeligible PRはmergeされる。
6. Browser/DEV repair/publication中でも新しい独立Ready PRはFast Laneへ入れる。
7. main / Production gate、review/hold/thread/dependency gate、exact-head validationを弱めない。
8. 追加OpenAI API/PAT/有料fallbackをRepositoryの通常制御面へ追加しない。
