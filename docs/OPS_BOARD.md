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
- ITERATIONS: 自律改善の軽量サマリ。詳細は専用 `iterations.html` で1 iteration単位に表示
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


### Iterations専用ページ

`iterations.html` は `runKey + iteration` を1件の表示単位とします。同一runKeyの1/3・2/3・3/3も別カードで、異なるrunKeyの並行セッションも混在させず識別します。

各カードはtheme、improvement summary、root causes、changes、changed paths、PR、validated head、merge SHA、verdictを表示します。stepは `観測 / 原因分析 / 実装 / Causal / Astra / After / Verdict / Freshness / Merge / DEV` の10段です。

telemetryに実測durationがあるstepは秒数を折れ線グラフで表示し、進行中stepだけ `startedAt` から現在時刻までをライブ計算します。未計測の旧iterationに秒数を推測して補いません。Astra/DEVなどGitHub Actionsに確定runがある場合は、その実run状態・時刻で補完できます。

トップ画面は最大3件の軽量サマリに留め、詳細な改修内容・step timing・並行session確認は専用ページへ委譲します。



### Iteration操作性

トップのITERATIONSは「一覧を見る」ための軽量面とし、1行タップで専用ページの該当iterationへ直接移動できること。各行は対象gameと現在stepを優先表示し、telemetryにgameがある場合は `対象確認中` を表示しない。

並び順は異常、進行中、DEV公開中、完了の優先度とし、件数表示も総数だけでなくRunning / Issues / Doneの内訳を示す。現在stepは `NOW: <step> <elapsed>` として一目で分かる表示にする。repairAttemptsは機械語の `repair N` ではなく、実態に合わせて `再検証 N回` と表示する。

専用iterationsページはURL fragmentで1 iterationを直接指定でき、遷移後に対象カードを画面内へ表示する。異常iterationには、その `runKey / iteration / PR / currentStep / failed step / validated head / last failure` を参考snapshotとして含む修復プロンプトのコピー操作を出す。プロンプトは必ず現在GitHub状態とactions summaryを再確認させ、PULSE snapshotだけで修復判断を確定しない。



### トップ一覧の共通進捗グラフ

ACTIVEとITERATIONSは同じ横向きduration timelineを使う。x軸は工程順で左から右へ進み、実測できた工程だけを線と点で描く。各工程名の直下にその工程の実測秒数を表示し、進行中工程は `startedAt` から現在までの秒数を表示する。未開始・未計測工程は右側に位置だけ残し、秒数を推測しない。

そのため、グラフが左半分までしか描画されていなければ、作業が工程列のおおむね左半分まで進んでいることを一覧だけで把握できる。y方向は各工程の所要時間で、長くかかった処理ほど高く描く。ACTIVEはFast DEVの `実装 → 検証 → Browser → merge → DEV`、ITERATIONSは自律iterationの代表stepを同じrendererで表示する。



### 一覧カードの視線設計

ACTIVEとITERATIONSの一覧カードは、スマートフォンで `タスク名 → duration timeline → 対象/時刻` を短い視線移動で読める情報階層にする。

- タスク名は一覧の主情報として十分な文字サイズを確保し、1行固定で潰さず最大2行まで許容する。
- 現在地を示すための大きな独立bandは置かず、duration timelineそのものを進捗の主表示にする。
- timelineは工程順を横方向、実測秒数を縦方向に使う。各工程の秒数を必ず文字でも併記し、未計測は `—` とする。
- SHA、再検証回数、対象、更新時刻はタイトルとtimelineより弱い補助情報とする。
- 一覧行同士はカードとして十分に分離しつつ、内部余白は情報群ごとに意味のあるまとまりを作る。無意味な均等余白で縦長にしない。


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
