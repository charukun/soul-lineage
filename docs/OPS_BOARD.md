# PULSE

`PULSE` は、輪廻転焦の公開状態と Integration の詰まりをスマートフォンから確認するための read-only 運用ダッシュボードです。

## 正本

表示値は GitHub API、GitHub Actions、公開済み `deployment-manifest.json`、公開用 commit status を正本とします。branch の先端と公開済み SHA は別々に扱い、branch に merge 済みでも公開 manifest が更新されていなければ deploy 済みとは表示しません。古い Production manifest で単一 SHA を確定できない場合も推測しません。

## 公開環境

- DEV / Production: GitHub Pages の公開 `deployment-manifest.json` と Repository branch を照合します。
- Visual Review 等: GitHub Actions の review / preview 系 workflow と `*/public` commit status を検出します。
- Ops Board 自体: Cloudflare Worker `rinne-ops` と Static Assets で公開します。

各環境は deploy 状態、公開済み SHA、deploy 日時、反映済み PR 件数と一覧を表示します。PR 一覧は公開 SHA から到達可能な GitHub merge commit を根拠に生成します。

## 開発ツール

PULSE の「開発ツール」には、独立した公開先だけでなくゲーム配下の検証・制作画面も登録できます。キャラクター工房は `apps/rinne/characters.html` を正本とし、輪廻転焦 DEV の公開 manifest に `rinne` が存在するときだけ `dev/rinne/characters.html` を公開中として表示します。公開 SHA と更新日時は同じ DEV manifest entry から取得し、URLだけを推測して公開扱いにはしません。

## 更新

Cloudflare Cron Trigger が5分ごとに Durable Object のスナップショットを更新します。GitHub Actions の Integration / DEV deploy 完了時にも、Worker 内だけが知る refresh token を使って再同期します。ブラウザへ GitHub/Cloudflare の認証情報は渡しません。

UI は1分ごとに保存済みスナップショットを再取得します。これは GitHub API の再同期ではないため、閲覧数で GitHub API 呼び出しが増えません。

## Integration の状態

Open develop PR はCI経過時間だけでは判定せず、`docs/INTEGRATION_RECONCILIATION.md` の current-state planを正本として `writer / validating / train / repair / active / blocked / deferred` を表示します。CI失敗、DEV公開失敗、branch divergenceなど実際の異常は従来どおり要対応ですが、CI成功後に一定時間openであることだけを理由に赤い「Integration滞留」へ分類しません。

Reconciliation snapshotが未取得、developが進んだ、またはPR headがplanと一致しない場合は古い判定へ戻さず「現在状態を再確認中」とします。PULSEは監視専用であり、既存Integrationのmerge/retry、安全gateを変更しません。

## Secrets

Cloudflare deploy は既存 Repository Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を Actions runner 内だけで利用します。Ops refresh token は API token から一方向に導出し、Worker の server-side variable として渡します。静的 UI と `/api/state` に secret は含めません。

## 操作レビュー後の受入条件（2026-09-12）

機能を増やすより、表示の正確さと確認操作の継続性を優先します。

- 同期失敗・古いスナップショット・現在のCI失敗を「要対応」に表示する。未確認を正常扱いしない。更新ボタンの近くに最終取得の経過時間を表示し、大きな全体サマリは復活させない。
- PRの対象アプリはサーバー側で変更ファイルから判定し、head/base SHAに紐づけて保存する。状態フィルタ操作からブラウザがGitHub APIを直接呼ばない。失敗時は未取得を明示し、更新されていない結果を現headの結果として扱わない。
- アプリ一覧は3列を維持し、アイコン・名称・環境・状態を読みやすくする。SHA・公開日時は開いて確認できるようにする。
- 手動・自動更新とも、選択中フィルタ、開閉状態、読んでいる位置を維持する。
- 先頭2行契約のない旧形式PRは、PR titleと本文概要へfallbackする。PR本文そのものは変更しない。
- 現在の失敗と、キャンセル・後続成功で解消済みの履歴を分ける。キャンセル単独を障害と断定しない。
- 名称・環境の整合性を扱うPR #89とは重複作業をしない。main / Production、ゲーム、Visual Review Lab、公開リンク集の内容は変更しない。

## 名称と3環境

ゲーム名は各workspaceのdisplayNameを正本とし、古い公開manifestの名前で上書きしません。各ゲームに開発・検証・本番を常に表示し、未登録は「未公開」、情報の重複や不正なパスは「確認中」としてリンクを有効化しません。環境全体が混在SHAでも各アプリの実公開SHAを表示します。検証版は固定リリースであり、DEVの次の更新で自動上書きしません。詳しくは GAME_ENVIRONMENTS.md を参照してください。

## 公開後検証と復旧

公開前に変更対象の単体テストとスマホ操作テストを行います。配信後は静的な `version.json` とWorkerの `/api/version` の双方を今回のcommitと照合してから、認証済みのサーバー間refreshで初期同期します。旧Workerの応答や古いスナップショットを新実装の成功として扱いません。公開APIのschema、同期状態、対象アプリ取得状況、現在の名称と3環境も検証し、公開ブラウザで同じ操作を再確認します。

GitHub取得失敗時にも既存の公開manifest fallbackを維持します。公開アプリの名称と環境だけが更新できた場合、GitHub履歴の取得日時は変更せず警告を残します。キャンセルと意図的なIntegration保留は障害や自動統合滞留として誤分類しません。

## Integration Rescue サマリ表示（2026-09-14）

Rescueの初期表示は、スマートフォンで一目で状況を把握できる視認性を優先します。詳細なWorker/Wave/履歴は既存の折りたたみ配下に残し、正確な状態分類や観測値は削除しません。

- サマリは状態ヘッダの下に4枚のKPIカードを2列で表示し、広い画面では4列へ展開する。
- 4カードは「対応中」「対応待ち」「要確認」「完了」を色付き左ボーダーと大きい数値で区別する。
- AI修復待ち、blocked、retry、stale、人判断、手動保留などの内訳は各カードの補助文として保持する。
- 実行中PRはサマリ直下にNOWとして最大3件表示し、PR番号と現在工程を読み取れるようにする。
- 状態ラベル、最終更新、KPI、NOW、詳細を見るの順序を維持し、320px幅でも横スクロールさせない。
- 詳細の既存disclosure、Rescue stateの意味、Integration gate、main / Productionの挙動は変更しない。

## Integration Flow の平易表示（2026-09-14）

Integration Flow の初期表示は内部用語を避け、「何件たまっているか」「どこで時間がかかっているか」「ユーザーの操作が必要か」を日本語で先に示します。BURN_DOWN、Demand、Quarantine、p95、Virtual Train、Auto tuning などの技術情報は削除せず、詳細表示へ退避します。

- `BURN_DOWN` は「滞留を解消中」、`BUSY` は「やや混雑」、`NORMAL` は「順調」と表示する。
- `Draft→Ready` は「実装開始 → 統合待ち」、`Ready→Merge` は「統合待ち → develop反映」、`Merge→DEV` は「develop反映 → DEV公開」と言い換える。
- p50 は「通常」、p95 は「遅いケース」、samples は「実績件数」として表示し、統計用語を初期画面から外す。
- ボトルネックに応じて「主な遅れは実装側 / Integration / DEV公開」の短い説明を出す。
- 人の判断が必要な案件が0件なら「いまはあなたの操作は不要」と明示し、必要な場合だけ件数を警告する。
- 技術的な処理速度、Virtual Train、自動調整、failure knowledge は折りたたみの「詳しい処理情報」に残す。
- 既存の状態計算、Rescue/Integrationの動作、品質gate、main / Productionは変更しない。

## Reconciliation Control Planeとの整合（2026-09-15）

PULSEのIntegration状態は `docs/INTEGRATION_RECONCILIATION.md` のcontrol planeを正本として説明します。旧来の「CI成功後10分openなら滞留」という単独判定は廃止し、Reconcilerが生成するcurrent-state分類と矛盾する警告を出しません。

- Ready PRの主分類は `writer / validating / train / repair / active / blocked / deferred` とし、同じPRを別の旧状態機械で二重判定しない。
- `blocked` は依存・hold・review・semantic conflictなどの理由を表示し、単なる「Integration滞留」へ潰さない。
- `validating` はexact-head CI/browser証拠待ちとして扱い、経過時間だけで失敗扱いしない。
- `repair / active` はRescue executorの担当として表示し、第二のIntegration queueとして扱わない。
- `writer` はdevelop writer候補、`train` はcombined validation候補であり、いずれもmerge済みを意味しない。
- `deferred` はbounded evaluationの次回評価待ちであり、異常とは限らない。
- Reconciliation snapshotが未取得またはdevelop/head不一致でfreshnessを証明できない場合は、旧判定へ断定的にfallbackせず「状態未確定」として表示する。
- 通知チャネルの未設定・送信失敗は delivery observability の問題として別表示し、`integration/develop=success` やReconciliationの成功を上書きして「Integration失敗」とは表示しない。
- PULSE自身の公開失敗、current CI/browser gate失敗、develop publication失敗は引き続き要対応として扱う。品質gateは弱めない。
