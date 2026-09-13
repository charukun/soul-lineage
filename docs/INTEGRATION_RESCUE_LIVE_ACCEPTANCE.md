# Integration Rescue 実稼働受入・復旧記録

Task: Integration Rescue 実稼働・復旧WORK
Result: IN_PROGRESS / NO_ADDITIONAL_API_BILLING — 自動Rescueの成功受入は未完了。
Observed: 2026-09-13 03:14 UTC / 12:14 JST
Recovery branch: `work/integration-rescue-live-recovery`

## 課金不要方針への訂正（ユーザー指示）

追加API課金なしが必須。以前のAPI残高追加・長期PAT追加を前提にした復旧依頼は撤回する。OPENAI_API_KEYの存在と過去の残高不足は旧実装の観測事実であり、課金を依頼する根拠にはしない。ChatGPT Workの既存契約・接続済みGitHubと標準Actionsの利用可能な範囲で復旧し、API有料経路への自動fallbackを設けない。

この記録は観測時点の証跡。再開時は最新develop・PR・Secrets存在・stateを再取得する。main / Productionを変更せず、実証を完了するまでSUCCESSにしない。

## 再取得した正本

- 開始時develop: `e544e6d1c6a364258f1f367119187e6ecdfcec17`
- 途中で#129が統合されたため再取得したdevelop: `3728d3612d84d2e91b637dbe90d852f8f8f1eb69`
- main: `ffeec4c3e7402c619cd25dff6bff4894fb5e5709`。本WORKから変更なし。
- #118 merge `e544e6d1c6a364258f1f367119187e6ecdfcec17` は最新developの祖先。
- #122 merge `e71bbd8e5c2cfaea78184523dcc7a4f2ff7f7c77`、#112 merge `c5fb1963bea68fc380d5f2523cea8464c6d91481`、#105 merge `de4e4dc6e59b55080a45ebe5243135a96d6f35f2` をGitHub PR詳細で再確認。
- AGENTS.md、README/MONOREPO、DEVELOPMENT、INTEGRATION、INTEGRATION_RESCUE、MOBILE_HYBRID_DEVELOPMENT、最新RINNE_PROJECT_EXECUTION_POLICY、Actions、Rescue Worker/store/coordinator/return/watchdog、PULSE collector/snapshot、notification/handoff実装を確認。

## 設定の存在と有効性

GitHub連携はRepository read/writeに利用可能だが、Secrets/Variables列挙APIは公開されたツールの対応対象外。存在確認は認証済みGitHub設定画面で実施。値の取得・表示・転記はしていない。

| 設定 | 観測結果 |
| --- | --- |
| OPENAI_API_KEY | Repository Secretに存在。値は秘匿。設定済みとAPI利用可能を区別する |
| API利用枠 | 同Secretを使った実Actions #128のCodex実行が残高不足で失敗。存在だけでは有効化できない |
| RESCUE_GITHUB_TOKEN | Repository Secret未登録 |
| MAX_RESCUE_CONCURRENCY | 開始時Variable未登録、実効既定4。本WORKでVariable `4` を保存し設定画面で再確認 |
| MAX_RESCUE_ATTEMPTS | Variable未登録、stateで実効既定3を確認 |
| RINNE_CODEX_MODEL | Variable未登録。実DispatcherログではAction既定モデルを利用 |
| CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID | Repository Secretsに存在。既存PULSE deploy成功の実績あり |
| NTFY_TOPIC_URL / NTFY_TOKEN | Repository Secrets/Variables未登録。通知先を推測していない |
| Environment secrets/variables | 設定画面に登録なしと表示 |
| Codespaces Repository secrets | 設定画面に登録なし |
| 既存GitHub Apps | AWS Amplify (ap-northeast-1)、ChatGPT Codex Connector。Rescueが利用できるApp ID/秘密鍵は登録されていない |
| state branch | `automation/integration-rescue-state` / `rescue-state.json` が実在 |

## 本WORKで起動した実Actions

[Rescue scan run 34734826770](https://github.com/charukun/soul-lineage/actions/runs/34734826770)

- GitHub Actions UIから既存 `deploy.yml` を **ref=develop / rescue_mode=scan** でdispatch。
- 実行SHA: `3728d3612d84d2e91b637dbe90d852f8f8f1eb69`
- Coordinator job `103664250336`: success。Return job `103664352165`: success。
- Worker matrix job: **skipped**。Integrate/publish job: **skipped**。
- run全体のsuccessは「走査処理が成功」の意味。修復・merge・DEV成功ではない。
- Coordinatorログ: `RESCUE_CONFIGURED: false`、`MAX_RESCUE_CONCURRENCY: 4`、`workers: 0`。
- state revision: 5、updatedAt: `2026-09-13T03:11:18.038Z`
- coordinator.runId: `34734826770`、heartbeatAt: `2026-09-13T03:10:59.626Z`、phase: `CONFIGURATION_REQUIRED`
- Coordinator heartbeatを観測済み。**Worker claim/heartbeatは未発生**。両者を混同しない。

| PR | 実state | attempt | 判定 |
| --- | --- | --- | --- |
| #90 | DETECTED | 0/3 | MERGE_CONFLICT |
| #93 | DETECTED | 0/3 | MERGE_CONFLICT |
| #107 | DETECTED | 0/3 | DEVELOP_ADVANCED |
| #121 | DETECTED | 0/3 | DEVELOP_ADVANCED |
| #126 | DETECTED | 0/3 | DEVELOP_ADVANCED |
| #130 | DETECTED | 0/3 | MERGE_CONFLICT |

#31/#32は `INCOMPLETE_BASE_COMPARISON` で保留。安全判定を弱めてキューへ入れない。
Waveは空、Worker IDなし、repair commitなし、Rescueによるmerge/DEV deliveryなし。
#93 headは `961b515fc720b7814f493ba5316ebdca40cff2b2`。open/非Draft/競合として実検知されたが、semantic reconciliationは未実行であり自動修復可能とはまだ判定しない。

## 実API失敗の証拠

[Dispatcher run 34733365065](https://github.com/charukun/soul-lineage/actions/runs/34733365065)、job `103660196257`。
公式Codex Actionが実際に起動し、2026-09-13T02:34:46Zに次を記録:

> You have no credits remaining. Add credits to continue using the API

キーなしではなく利用残高の問題。新しいAPIキーを無意味に作り直したり、同じ失敗を反復させたりしていない。追加課金を求めず、このAPI依存経路を廃止する。

並行PR #130はDispatcherをAPI課金不要のWork handoffへ移行する変更だが、観測時は未mergeであり、本文にもIntegration Rescueは別経路と明記されている。#130の目的を無断で変えず、Rescueが既にAPI不要になったとは扱わない。

## 認証の再評価

- 標準GITHUB_TOKENはCoordinatorのstate CAS、PR調査、通常Integrationへのworkflow_dispatchで既に利用されている。
- 現行CIはpull_requestのexact head/artifactを検証する。GITHUB_TOKEN pushに置換するだけでは無人CI連鎖を保証できない。現在のGitHub仕様でも自動生成PRイベントに承認が必要になる場合がある。
- workflow_dispatchはGITHUB_TOKENから起動可能だが、CIの別イベント経路への移植・exact-head artifactの検証設計が別途必要。単に認証条件を削除しない。
- Cloudflare cronはActions jobの外で継続するため、jobに限定されたGITHUB_TOKENを永続Secretへ保存する代替は使わない。
- GitHub App短期tokenなら長期PATを避けられるが、本人管理のApp ID/秘密鍵が必要。既存Connector/Amplifyの資格情報を抽出・転用しない。
- 旧実装はPAT追加を前提としていたが、その設定依頼は撤回。標準GITHUB_TOKENによるpushと明示的なexact-head検証dispatch、接続済みGitHubを使うWork修復を再評価する。
- tokenはpushとwatchdog dispatchにだけ利用。Contents read/write、Actions read/writeが必要。古いPRへ最新developのworkflowを取り込むpushにはWorkflows writeも必要。PR/Issues調査やstateの他操作はjobのGITHUB_TOKENを維持する。管理権限・全Repositoryアクセスは不要。

参考: [GitHub workflow trigger](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)、[App installation token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

## PULSE・watchdog・通知

[PULSE](https://rinne-ops.c-okamoto.workers.dev/#rescue-section) を実ブラウザで操作し、DOMと描画を確認。
裏側の `/api/state` のintegrationRescueも取得してGitHub stateと照合した。

- state generatedAt `2026-09-13T03:11:18.038Z` が一致。
- CONFIGURATION_REQUIRED、active 0/max 4、queued 6、reserved/blocked/validating/returned/manual/retry/staleは0。
- Worker ID、heartbeat、Wave、push、merge、DEV履歴が空であることも実stateと一致。fixtureではない。
- 通知欄は `not configured`。ntfy外部送信・スマホ到達は未実証。
- 独立watchdogの実装は10分cronだが、token未登録時は公開stepがwarningで終了する。
- 直近確認したPULSE run `34733278530` はfeature branch公開で、watchdog job `103659939251` はskipped。独立watchdogが稼働済みとは扱わない。Cloudflare管理APIでのデプロイ状態はこのWORKでは未確認。
- baseline DEVには `e544e6d...` の `integration/develop=success`（run `34734386310`）があるが、これは自動Rescue実証の成功ではない。

## GitHub経路と本WORKの変更

1. 通常git clone/fetch/checkout成功。
2. 通常git push --dry-runは認証情報なしで失敗。長時間retryしていない。
3. 接続済みGitHub APIで復旧branchと本記録を反映。実コード・対象PR branch・mainを変更していない。
4. 既存Codespaceを確認。別branchに未commit作業があり、それを変更/再利用していない。APIが使えるため切替不要。
5. MAX_RESCUE_CONCURRENCY=4を保存。
6. 実scanを1回dispatch。runを数十秒おきに反復pollせず、受付・結果・state更新・PULSE照合の節目で取得。

## 同じWORKで追加API課金なしの復旧を継続

API残高追加・APIキー新設・長期PAT新設は依頼しない。既存のRescue状態遷移・通常Integration gateを維持した経路を実装・検証する。並行PR #130のDispatcher移行は再取得して尊重する。

- API呼出しを行わないActions修復と、意味判断が必要な場合の既存ChatGPT Work経路を分ける。
- GITHUB_TOKEN pushに伴うCIイベント抑止は、実際のexact-head fast/browser検証経路で解消する。成功statusの捏造で代用しない。
- Workイベントと既存監視で滞留を再取得し、claim/heartbeat/attempt/修復結果を実GitHub stateに記録する。
- #93を含む危険な仕様衝突・hold・review異議は自動解除しない。安全な実PRの修復からDEVまでを実証する。
- PULSEとstateの一致・外部通知の実送信も引き続き完了条件とする。未実証の項目は成功扱いしない。
