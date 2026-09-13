# Integration Rescue 実稼働受入・復旧記録

Task: Integration Rescue 実稼働・復旧WORK
Result: FAILED / CONFIGURATION_REQUIRED — 自動Rescueの成功受入は未完了。
Observed: 2026-09-13 03:14 UTC / 12:14 JST
Recovery branch: `work/integration-rescue-live-recovery`

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

キーなしではなく利用残高の問題。新しいAPIキーを無意味に作り直したり、同じ失敗を反復させたりしていない。キーが属するAPI organization/projectの利用枠を本人が復旧する必要がある。

並行PR #130はDispatcherをAPI課金不要のWork handoffへ移行する変更だが、観測時は未mergeであり、本文にもIntegration Rescueは別経路と明記されている。#130の目的を無断で変えず、Rescueが既にAPI不要になったとは扱わない。

## 認証の再評価

- 標準GITHUB_TOKENはCoordinatorのstate CAS、PR調査、通常Integrationへのworkflow_dispatchで既に利用されている。
- 現行CIはpull_requestのexact head/artifactを検証する。GITHUB_TOKEN pushに置換するだけでは無人CI連鎖を保証できない。現在のGitHub仕様でも自動生成PRイベントに承認が必要になる場合がある。
- workflow_dispatchはGITHUB_TOKENから起動可能だが、CIの別イベント経路への移植・exact-head artifactの検証設計が別途必要。単に認証条件を削除しない。
- Cloudflare cronはActions jobの外で継続するため、jobに限定されたGITHUB_TOKENを永続Secretへ保存する代替は使わない。
- GitHub App短期tokenなら長期PATを避けられるが、本人管理のApp ID/秘密鍵が必要。既存Connector/Amplifyの資格情報を抽出・転用しない。
- 現行実装を起動する最小の追加資格情報は、対象をこのRepositoryに限定した期限付きfine-grained PATを `RESCUE_GITHUB_TOKEN` に登録する方法。
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

## 本人操作後に同じWORKから再開

本人が行う設定はまとめて一度だけ依頼する。Secret値は会話へ貼り付けない。

1. 既存OPENAI_API_KEYが所属するAPI organization/projectの課金画面で利用残高を復旧する。
2. GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokensで、Resource owner=charukun、Only select repositories=soul-lineage、期限あり、上記最小権限のtokenを発行。
3. Repository Settings → Secrets and variables → Actions → New repository secretへ `RESCUE_GITHUB_TOKEN` として登録。
4. 同じSecret画面にスマホで購読している実ntfy送信先を `NTFY_TOPIC_URL` として登録。認証が必要なtopicは `NTFY_TOKEN` も登録。購読先が未作成ならその設定が必要。

設定後のWORK手順（監視ループを起動しない）:

```sh
git fetch origin
gh workflow run ops-board.yml --repo charukun/soul-lineage --ref develop
gh workflow run deploy.yml --repo charukun/soul-lineage --ref develop -f rescue_mode=scan
```

- 最新developと#130等の並行変更を再取得し、資格情報の存在と有効性を再確認。
- ops-boardのwatchdog公開/Secret登録成功と、後続cronからの実dispatchを確認。
- 実候補を再評価してclaim/Worker ID/attempt/Wave/heartbeatを記録。危険な仕様衝突はmanualを維持。
- Workerの修復commit/push → RETURNED/CHECKING → 通常exact-head fast/browser gates → merge → 最終developのintegration/develop=success → 公開manifest/source/browserを実証。
- #93がmanualなら別の安全な実候補で1件以上成功させる。安全な実候補がない場合のみ隔離した検証用PRを作成する。
- PULSE、state、snapshot、run/artifactを再照合し、既存ntfyへtask/結果/branch/SHA/PR/実証対象/DEV結果を送信する。
- 成功証跡をこの記録とPRへ追記し、完了条件をすべて満たしてからSUCCESSにする。
