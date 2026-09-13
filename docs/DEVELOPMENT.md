# 開発WORKとIntegrationの分担

実装の正本は最新develop、運用の正本は現在のRepositoryルールとGitHubの状態です。過去のPR番号や古いhandoffの完了報告を現在の状態とみなしません。

| 担当 | 完了条件 |
| --- | --- |
| 実装WORK | 最新develop → branch push・Draft PR → 実装 → 影響範囲の高速検証・push → Ready for review |
| Integration | 最新Checks・依存・レビュー・競合を判定 → developへ統合 → 最終SHAの影響範囲高速検証 → DEV公開 → 公開HTTP/source確認 |

実装セッションの責任終了・CI同期待機禁止・通知・復旧の正本は [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md)。Ready for review → `READY_FOR_INTEGRATION` handoff → 結果報告で終了し、CI/browserのRunning・Queued・Pendingを完了まで追跡しません。変更した機能の必要な局所テストは維持し、重いE2E・全体検証はIntegrationへ任せます。明示的なIntegration担当依頼は別責務です。

## 実装WORK

1. `AGENTS.md`、最新develop、対象app/packageの仕様を確認。コード変更を伴う通常の実装タスクは、コード修正前に専用branchをpushし、develop向けDraft PRを作成してから実装する。調査・相談・状況確認・文章作成のみのタスクは対象外。
2. `npm ci` と `node scripts/validate.mjs fast origin/develop HEAD`。影響appのcheck/test/build、共有テストは1回。基盤変更時は基盤テストも実施。
3. push前に `npm run push:route -- origin/develop HEAD` を実行。Chat/WORK/Codex実行環境の通常gitを第一候補とし、利用可能なGitHub連携/API、Codespaces＋通常gitの順で切り替える。`CODESPACES_GIT` または容量・Base64・payload上限系エラー時は、同じbranchをGitHub Codespacesで開いて通常`git push`へ即時切り替える。大きなバイナリを連携APIで分割/Base64再送しない。詳細は `docs/MOBILE_HYBRID_DEVELOPMENT.md`。
4. PR本文先頭は下記の2行契約を維持し、その下へ変更理由・挙動・影響app/package・検証結果・残るリスクを書く。依存があれば `Depends-On: #12, #13`、なければ `Depends-On: none`。
5. 完了したらReady for review。未完了、仕様未決定、取り込み待ちはdraftまたは `integration:hold`。既存Ready PRの保留もこのlabelで制御。
6. Ready化で実装セッションの責任を終了。最終報告に実装完了・branch・commit SHA・PR URL・Ready済み・`READY_FOR_INTEGRATION`・CIをIntegrationへhandoff済み・高速検証結果を記載する。GitHub側のhandoff recorderの完了も待たない。通知やCIの未確認をそのまま明記し、最終応答を保留しない。

単一appの変更をrootゲーム構成へ戻さず、3ゲームの独立した入口と共有package境界を維持します。通常作業でサブエージェントは使用しません。不要なフルCI、各PRごとのDEV確認、古いLibrary handoffの再作成は不要です。

## 実装WORKからCodespacesへ切り替える場合

Codespacesは「別の開発フロー」ではなくpush経路だけの代替です。最新developを正本とし、作業branch・fast validation・develop向けPR・Integration引き渡しは変更しません。100 MiBを超える単一ファイルは通常Gitへpushせず、Git LFSまたは適切なasset配布方式を選びます。

## Integrationへの引き渡し

Ready PRのCI監視・結果判定・develop統合・CI/CD・DEV反映はIntegration側の責任です。実装セッションを監視役として待機させません。既存のGitHubイベント・Actions・通知を使い、CI失敗時のみ失敗run・head SHA・ログ/対象テスト・修正範囲を実装ワーカーへ返します。新しい独自タスク管理は追加しません。修正ワーカーは同じPR/branchを復旧起点とし、必要ならDraftへ戻して修正・高速検証・push・Ready化まで進め、再び待機せず終了します。レビュー・競合・明示holdは従来どおりIntegrationが扱います。

実装成功通知は `READY_FOR_INTEGRATION`。既存SUCCESSの実装完了に相当し、Integrationの `INTEGRATED` / `DEV_DEPLOYED` と区別します。終了信号と通知未設定・失敗時の扱いは [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md) を参照。

自動判定で意味上の仕様矛盾まで証明することはできません。共有契約の変更・意味上の競合はPRに明記し、解消前にReadyへ進めないでください。自動判定できないものは保留し、Integration担当が判断・必要修正・再検証します。

[自動Integrationと復旧](INTEGRATION.md)

通常DEVは高速公開を優先。重い全体回帰・E2E・実ブラウザ検証は必要時の`full_verification=true`へ分離し、Production前の品質基準は維持します。

## 実装開始前Draft PR（通常のコード変更タスク）

コード修正前に最新developから作業branchを作成・pushし、Draft PRを作る。作業中はDraftを維持し、実装・必要最低限の高速検証・commit/push完了後に本文を実施結果へ更新してReady for reviewへ変更する。調査のみ・相談のみ・状況確認のみ・文章作成のみではDraft PRを作らない。

GitHubは差分のないbranchからPRを作れないため、最初の差分には既存の仕様・運用文書へ今回必要な実施範囲や受入条件を最小限追記する。コード本体はまだ修正しない。恒久的に意味のある差分だけを使い、ダミーファイル・空commit・無意味な履歴を作らない。適切な文書差分が作れない場合やPR作成に失敗した場合も、通常git → GitHub連携/API → Codespaces＋通常gitの別経路を確認する。なお作成できなければ理由とbranch/commitを報告して実装を継続し、作成可能になり次第Draftへ戻す。PR作成失敗だけで実装不能としない。

PR本文は空行・見出し・HTMLコメントを先頭に置かず、必ず次の連続した2行で始める。

```text
MasterCharacter量産基盤の整備
Sendagaya_Shinoを基準モデル化し、量産用共通構造と確認シミュレーターを追加
```

1行目は短い作業タイトル、2行目は変更・修正・追加内容の簡潔な詳細。Draft作成時は予定、完了時は必要に応じて実施結果に更新する。3行目以降は自由。独自Task-ID、状態機械、追加の依存管理は導入せず、既存Depends-Onの扱いだけ維持する。

| GitHub標準状態 | 一覧での意味 |
| --- | --- |
| Draft | 作業中 |
| Ready for review | Integration待ち（既存hold・レビュー・Checks等の条件は別途適用） |
| Merged | 統合完了 |
| Closed（未merge） | 中止・終了 |

### CI・管理画面・復旧

- develop向けDraftはcheckoutとdiffの軽量チェックのみ。install・build・重いCI/CD・通常Integration・DEV公開は起動しない。Readyへの変更で既存fast gateを起動し、重い診断は従来どおり必要時だけ実行する。main/Productionの品質基準は変更しない。
- 管理画面はGitHub RESTのPR一覧（`state=all`、pagination必須）/PR詳細から `number`, `html_url`, `body`, `state`, `draft`, `merged_at`, `updated_at`, `head.ref`, `head.sha`, `base.ref` を取得する。GraphQLでは対応する `isDraft`, `mergedAt`, `updatedAt`, `headRefName`, `headRefOid` を使える。先頭2行をタイトル＋詳細として表示し、更新日時はタイムゾーン付きで表示する。古い形式の既存PRはPR titleと本文概要へfallbackし、本文を勝手に書き換えない。
- `merged_at`を先に判定し、次にclosed、open+draft、open+非draftを判定する。最終更新時刻と現在時刻の差を表示し、画面の表示閾値で長時間未更新Draftを判別する。`updated_at`はGitHub上の更新時刻であり実行中保証・heartbeatではない。自動closeや自動Ready化はしない。
- セッション停止時は当該Draft PR・branch・最新commit・handoff・最新developとの差分・CI/CDを復旧起点とし、別セッションで同じPRを継続する。既存task-start/heartbeat/watchdog通知を置き換えない。
- 開始時のbranch push/Draft登録は完了通知とは区別する。実装・高速検証・push・Ready更新後の成功名は `READY_FOR_INTEGRATION`。FAILEDは到達工程、失敗理由、試した経路、復旧経路を含める。

### Visual Review Labは独立運用を維持

Labの長寿命Draftは同一Repositoryの専用head branch `work/visual-review-lab-v2`（現行PR #23）で識別し、一覧には「Visual Review Lab」と表示する。PR番号や本文だけに依存せず、通常実装のDraftとは別種別にする。Labを未更新タスク警告に混ぜず、更新日時自体は表示する。

Lab専用 `review-preview.yml` の公開条件（専用branchへのpush/手動実行、`REVIEW_PREVIEW_ENABLED`）、`wrangler.review.jsonc`、Cloudflare Workers Static Assets、既存URLと専用concurrencyを維持する。通常Draftの作成をLab CI/Workers公開のtriggerにしない。Lab専用branchへ通常タスクをpushしない。Labは人間が見た目を高速確認する独立経路であり、通常実装・Integrationの必須ブロッカーにしない。Lab自身のDraftも通常Integrationから除外する。
