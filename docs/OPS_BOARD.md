# PULSE v2

PULSE は `charukun/soul-lineage` の開発状況をスマートフォンから確認する read-only control plane です。この文書を PULSE の唯一の仕様正本とします。`ops-board/README.md` は実装入口であり、状態意味を再定義しません。

## 1. 原則

PULSE は GitHub のコピーDBを作りません。GitHub、Cloudflare Worker、公開manifestの事実を読み取り、表示用snapshotを一時的に組み立てます。snapshotやブラウザキャッシュは正本ではありません。

PULSE自身の同期障害と、ゲーム・ツールの公開状態は別レイヤーです。PULSEが最新状態を取得できなくても、管理対象アプリを0件にしたり、公開待ちへ書き換えたりしません。

## 2. 正本

| 情報 | 正本 |
| --- | --- |
| 管理対象アプリと分類 | `scripts/application-catalog.mjs` の `PULSE_SURFACES` |
| DEV公開状態 | 各DEV Workerの `version.json` 実体確認 + current develop SHA の GitHub commit status `dev/<deployApp>` |
| DEV公開URL | `scripts/distribution-targets.mjs` |
| 作業キュー | GitHub の open develop PR |
| CI / Actions失敗 | GitHub Actions |
| staging / Production | 公開 `deployment-manifest.json` |
| PULSE自身の公開 | `dev/pulse` status + `https://rinne-ops.c-okamoto.workers.dev/` |
| PULSE同期ヘルス | `/api/state.syncStatus` |
| 自律iteration進捗 | PR bodyの `autonomous-iteration-telemetry:v1` marker + GitHub Actions / merge事実 |

GitHub Pages の旧 `/dev/` はDEVの正本ではありません。DEVの判定に使用しません。

## 3. 管理対象

PULSEのトップに表示する管理対象は次です。

- product game: `rinne`, `village`, `demon`
- developer tool: `character-studio`, `visual-review`
- reference app: `eclipse`
- control plane: `ops-board` (PULSE)

WAYFINDERや専用previewは詳細情報として保持できますが、DEV App Healthyの母数には含めません。

## 4. DEV状態

DEV状態は次の5種類だけです。

- `success`: DEV Worker の `version.json` が正常で、app / environment / exact commit を確認できる
- `deploying`: current develop SHA に `dev/<app>=pending` がある
- `failed`: current develop SHA に `dev/<app>=failure|error` がある
- `unknown`: DEV実体を確認できず、進行中・失敗を示すcommit statusもない
- `missing`: staging / Productionなど、正式公開定義そのものが存在しない

Per-App DEV Publish は変更対象だけを公開するため、current develop SHA に未変更アプリの `dev/<app>` status が存在しないことは正常です。その場合は既に配信中の `version.json` を直接確認して `success` を維持します。逆に current develop の `pending / failure / error` は更新中・失敗の優先情報として扱います。

`unknown` を `waiting / queued` と解釈してはいけません。QUEUED表示は実際のpending事実がある場合だけです。

## 5. 同期と障害

GitHubイベント後の認証付きrefreshを主経路とします。ブラウザの「再読込」は保存済みPULSE snapshotを読み直す操作であり、ブラウザからGitHub APIを呼びません。

Workerの再起動でメモリsnapshotが失われ、永続GitHub tokenも存在しない場合だけ、PULSE Workerは公開repositoryのGitHub APIからbounded cold-start recoveryを行います。この復旧は1回あたり最大6 request、直近40 PRまでの浅い状態に限定し、履歴全走査・変更ファイル深掘り・Rescue state取得は行いません。通常の認証付きevent refreshを置き換えず、ブラウザからGitHub APIへ直接接続もしません。`githubApi.scope=public` と `pullSync.mode=public-recovery` で復旧経路を識別できます。

PULSE snapshot、GitHub APIキャッシュ、control historyはDurable Objects永続ストレージを正本にしません。Free tier上限や保存障害がPULSE全体を停止させないことを優先します。peer-world永続データは別責務です。

同期失敗時は以下を守ります。

1. 直近の正常snapshotがあればLast Known Goodとして表示する。
2. Last Known Goodがなくても `PULSE_SURFACES` から管理対象アプリを表示する。
3. 状態が取れないアプリは `unknown` とする。
4. アプリ数、既知URL、分類を0件へ崩さない。
5. 「再同期中」はPULSEヘルスだけに表示し、アプリの公開状態を書き換えない。

## 6. トップ画面

トップは ACTIVE / ITERATIONS / APPS / ISSUES / RECENT の5区画です。

- ACTIVE: Draft / Ready のopen develop PR。PRが存在するだけでは実行中とみなさず、観測できるGitHub Actions実行・検証・merge準備状態を別のexecution stateとして表示する。
- ITERATIONS: 自律改善の内容・現在地・次の確認・反映結果を日本語で読む軽量サマリ。詳細は専用 `iterations.html` で1 iteration単位に表示する。
- APPS: 全管理対象のDEV状態
- ISSUES: 実際の失敗と人の確認が必要な項目。各異常から、現在GitHub状態を再確認して同じPRで修復するためのAIプロンプトをコピーできる
- RECENT: 直近Fast DEVセッションを `実装 → 検証 → Browser → merge → DEV` の5段で表示し、セッション情報がない場合だけmerge・DEV公開・PULSE状態変化を表示

トップのApps Healthyは管理対象7件を母数とし、各DEV実体の `version.json` を確認できたアプリをHealthyとして数えます。ゲーム3本だけを数えません。

### ACTIVE execution state

ACTIVEカードはopen PRの存在と「今動いている処理」を分離する。表示は `VALIDATING / RUNNING / MERGING / BLOCKED / DONE / IDLE` を使用する。

- `VALIDATING`: exact-head validationの実runが進行中。
- `RUNNING`: Browser / DEV publishなど、そのPRに結び付くGitHub Actions実runが進行中。
- `MERGING`: Readyかつ必要な検証が成功しており、merge境界にいる。
- `BLOCKED`: 現在工程に失敗があり、次工程へ進めない。
- `DONE`: develop merge後の完了状態。
- `IDLE`: open PRは存在するが、GitHub上で現在進行中の処理を観測できない。

`IDLE` はChatGPTランタイムそのものの停止を断定する状態ではない。PULSEが観測できるGitHub側のlive signalがない、という意味に限定する。各カードはbranch / exact headと合わせてlast activityを表示し、commitが存在するだけで `RUNNING` と表示してはいけない。

### 自律改善の分類と状態

有効なiteration telemetryは対象game・runKey・iterationの正本とする。旧形式は明示的な自律iteration意図と、対象gameのPR target・タイトルまたはreceiptで識別する。本文の例に `kuumetsu / rinne / village` や `Iteration 1` が登場するだけのPULSE・運用画面修正をゲームiterationへ混入させない。通常作業の件数制限より先に自律iterationを抽出する。

実行、取り込み、公開、効果は別の事実として表示する。

- `running` / 実行中: 現在headに対応するGitHub Actions実runを観測した未反映iteration。
- `waiting` / 待機・未確認: 未反映で、実行中の処理を確認できないもの。カードは「実行未確認」「反映待ち」「最新状態未確認」を理由つきで区別する。Chat側の停止は断定しない。
- `problem` / 要対応: 未反映の現在工程に失敗記録がある。過去headの失敗・実行は現在headの状態を置き換えない。同じheadの新しい確定結果は古い結果やtelemetryより優先する。
- `complete` / 取込済み: GitHubの `merged_at` によりdevelopへの取り込みを確認したもの。カードは「develop反映済み」と明記する。open PRの合成 `merge_commit_sha` は取り込みの証拠ではない。

DEV公開処理は取り込み後の別表示とし、runがないときは未確認であって公開待ちではない。workflow全体の成功・失敗だけを取得したときは「DEV公開処理完了／問題」と限定して表示し、対象ゲームの公開版の成功・失敗と同一視しない。ゲームの実公開版はAPPSの正本で確認する。公開処理の失敗で取込済み件数を取り消さない。

効果判定も別表示とし、`supported` は「効果を確認」、`inconclusive` は「効果は未確定」、`refuted` は「改善仮説は不成立」とする。取り込み完了だけで改善効果が証明されたとは表示しない。

### Iterations専用ページ

`iterations.html` は `runKey + iteration` を1件の表示単位とする。同一runKeyの1/3・2/3・3/3も別カードで、異なるrunKeyの実行も識別できる。PR番号を表示し、どのカードも単に「Iteration 1」とだけ見えることを避ける。

各カードはtheme、improvement summary、root causes、changes、changed paths、PR、validated head、merge SHA、verdictを保持する。step順はtelemetryの `ITERATION_STEPS` が正本であり、改善後の確認は最終Astra検証より前に並ぶ。工程名と現在地は利用者向けの日本語でも表示する。

トップと専用ページで同じ状態モデルを使い、件数・フィルタ・反映結果を一致させる。件数は取得できた直近記録の集計であり、全履歴や常時並行実行数を意味しない。更新時刻は「最終記録」「照合」とラベルを付け、何の時刻かを明示する。

### Iteration操作性

トップのITERATIONSは最大3件。対象game、改善内容、状態、現在または最後に記録された工程、未反映・問題の理由、次に確認することをグラフを解読せずに読めること。要対応、実行中、待機・未確認、取込済みの順とし、4群の件数を日本語で表示する。公開処理の問題は別件数とする。非表示の残りがある場合は「ほかN件」と全件へのリンクを明示する。

カード本体のタップで専用ページの該当iterationへ直接移動できる。URL fragmentにより対象カードを画面内へ表示する。異常iterationには `runKey / iteration / PR / currentStep / failed step / validated head / last failure` を参考snapshotとして含む修復プロンプトのコピー操作を保持する。プロンプトは現在GitHub状態とactions summaryの再確認を要求し、snapshotだけで修復判断を確定しない。反映済みの公開処理問題にはそのrunへのリンクを出し、取り込み済みPRの再mergeを要求しない。

### 工程時間と視線設計

ACTIVEは従来どおり `タスク名 → duration timeline → 対象/時刻` を主な視線順とする。ITERATIONSは `対象・状態 → 改善内容 → 現在地・理由・次の確認 → 公開・効果 → 補助情報` を優先する。スマートフォンで状態・理由を隠したり、低コントラストの小さい文字や色だけに意味を依存させたりしない。

ITERATIONSのduration timelineは「工程と所要時間を見る」に折り畳む補助情報とする。カード本体のリンクと開閉操作を入れ子にしない。代表工程のrendererはACTIVEと共通のまま、横軸は工程順、縦軸は所要時間であり完了率・品質ではないと説明する。実測できた連続する工程だけを線でつなぎ、未計測を推測しない。

telemetryに記録されたdurationは保持する。時計のライブ計算は対応する実runを観測できる場合だけとし、観測できないrunning記録、反映済み、同期がdegradedの記録の時計を増やし続けない。新たなpolling・ブラウザからのGitHub呼び出し・Actions工程を追加せず、既存snapshotと同じ実測情報から表示する。

タスク名・状態は十分な文字サイズで折り返しを許容する。SHA・再検証回数・runKeyは詳細の補助情報とし、repairAttemptsは「再検証 N回」と表示する。タップ領域、キーボードフォーカス、説明の文言を保ち、色だけを読ませない。

## 7. PULSE公開成功

PULSEのstatic assetが配られただけでは正常とは扱いません。

PULSEを変更したdevelop mergeでは、既存Per-App DEV Publish laneで `pulse` を公開し、その後の認証付きrefreshが `syncStatus=ok` を返すことを要求します。PULSE自身のrefreshが失敗した場合、そのPULSE公開runは成功扱いにしません。

他アプリのDEV公開はPULSE障害によって巻き戻しません。PULSEは観測系であり、ゲーム公開の正本ではありません。

## 8. staging / Production

staging / Productionだけは公開manifestを使用します。DEVと混ぜません。main / Productionの品質gateはPULSE都合で変更しません。

## 9. 禁止

- Pages DEVを復活させる
- snapshotをGitHubより強い正本にする
- 同期失敗を0 Appsとして表示する
- status未取得をQUEUEDにする
- 手書きの別アプリ一覧を増やす
- PULSE障害をゲーム公開失敗として扱う
- main / ProductionをPULSE修復のために変更する
