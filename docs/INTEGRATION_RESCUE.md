# Integration Rescue

Ready PRが修復可能な理由で停止したとき、Coordinatorが変更領域と依存順を判定し、独立Actions jobのWorker Poolへ配分する。修復先は元PR branchだけ。通常Integrationのexact-head checks、review、未解決thread、Depends-On、develop baseline、merge直前再検証、bounded merge、DEV公開は維持する。

## 実装と責任

| 構成 | 実装 | 責任 |
| --- | --- | --- |
| Coordinator | `scripts/integration-rescue-coordinator.mjs` | GitHub再取得、対象判定、優先度、依存・scope比較、Wave/slot/claim、死亡検知 |
| Policy | `scripts/integration-rescue-policy.mjs` | 純粋な状態遷移、GREEN/YELLOW/RED、snapshot再評価 |
| Durable state | `scripts/integration-rescue-store.mjs` | GitHub Contents APIのblob SHA条件付き更新によるCAS |
| Worker Pool | `.github/workflows/integration-rescue.yml` | dynamic matrix、独立runner/checkout、PR単位concurrency |
| Safe base-update worker | `scripts/integration-rescue-worker.mjs` | 独立差分のbase更新、信頼済みwrapperの検証、staged commit作成 |
| Return / notification | `scripts/integration-rescue-return.mjs` | 通常Integrationへ集約dispatch、merge/DEV追跡、通知outbox |
| Independent watchdog / push relay | 既存ChatGPT Workタスク、`scripts/integration-rescue-work-push.mjs` | PULSEと別にGitHub stateを再取得、元PRの通常pushと既存scan起動を担当 |
| PULSE | `ops-board/rescue.mjs`, `public/rescue-board.*` | GitHub stateの観測ビュー。制御やmerge権限は持たない |

## 起動経路と既定branch制約

既定branchはmain。今回mainは変更しない。新設workflowの`workflow_dispatch`、`schedule`、`workflow_run`、`repository_dispatch`が既定branch上に存在するという前提を置かない。

既定branchにも存在する`deploy.yml`を`ref: develop`で起動し、develop側の新しい`rescue_mode: scan`入力でRescue専用走査を行う。このmodeではmerge/deploy jobを起動しない。通常のdevelop pushおよびIntegration実行後も同じreusable Rescue workflowへ接続する。CIのReady/synchronize/review等のPRイベントは短い`Request Rescue observation`からこの既存経路を起動する。

競合PRでは`pull_request` workflow自体が起動しないことがあるため、独立Work watchdogがイベント欠落・worker死亡・孤立queueを再走査する。PULSEを閉じても、PULSE自体が停止してもWork watchdogとRescueは継続する。scopeはGitHub上で再取得し、外部のAPIモデルへPRコードやログを渡さない。

Worker終了時は同じWaveの他Workerを待たず通常Integrationへの復帰を依頼する。復帰dispatchはstate上の短いleaseで重複予約を防止。自己dispatchは未送信の復帰headがある場合のみで、同じheadの送信済み記録から再発火しない。進展のないqueueはwatchdogで有限retryし、無限自己dispatchしない。

## 追加API課金なしの実行経路

ユーザーの必須条件は追加API課金なし。Rescue workflowから `openai/codex-action`、`OPENAI_API_KEY`、`RINNE_CODEX_MODEL`、`RESCUE_GITHUB_TOKEN` を除去した。API残高追加やPAT新設は起動条件にしない。有料APIへのfallbackはない。既存ChatGPT Workの利用枠が利用できない場合はGitHubに停止状態を残し、追加クレジットを自動購入しない。

| 設定 / 接続 | 用途 |
| --- | --- |
| `MAX_RESCUE_CONCURRENCY` | 既定4、1〜16。Actions全run合計のclaim上限 |
| `MAX_RESCUE_ATTEMPTS` | 既定3、1〜10。PRごとの有限試行 |
| 標準 `GITHUB_TOKEN` | PR調査、state CAS、検証済みGit tree/commitオブジェクト作成、既存workflow dispatch |
| 既存ChatGPT Work + GitHub接続 | 検証済みcommitの元PR branchへの通常反映、独立watchdog |
| 既存Cloudflare Secrets | PULSEの観測更新・公開。Rescueの認証キーに転用しない |
| 任意 `NTFY_TOPIC_URL` / `NTFY_TOKEN` | 設定済みの場合のみ既存通知先へ送信 |

Actions Workerは実checkoutで最新developを非commit mergeし、PRの全変更fileのblob/modeが保持されることを確認する。同file変更、text conflict、関連する実行コードや共有契約、control同士の更新は `FAILED_MANUAL`。clean mergeを意味的安全の証明にせず、範囲が独立したbase更新だけを自動処理する。manual hold、Changes requested、未解決threadは解除しない。

非特権userの `npm ci` とtrusted fast検証が成功したら、既にGitHubに存在するblobだけでGit tree/commitを作り、ローカル検証treeとの完全一致を確認する。これは**branchへ未反映**の `AWAITING_PUSH`。Worker leaseを解放し、PULSEにstaged commitとWork push待ちを表示する。

検証の作業directoryはsudoでUID変更した後も明示し、npmのprefixを同じ実checkoutへ固定する。非特権UIDからcwd・lockfileを読み取るpreflightを実行し、runner所有の親directoryには通過権限だけを追加する。trusted controlの書込禁止と検証後のcommit/tree/config不変検査は維持する。PRコメントを行うWorker/returnには標準GITHUB_TOKENのpull-requests writeを付与する。通知失敗は未送信のoutboxに理由と最大3回のbackoffを残し、修復・Integration復帰の成否とは独立させる。

標準GITHUB_TOKENのpushイベント抑止・workflow変更権限に頼らず、既存Workが `integration-rescue-work-push.mjs` の安全確認とCASを経て元PR branchをfast-forwardする。接続済みGitHubの通常イベントから既存CIが起動する。CI実装・fastGate・exact-head artifact・review規則は変えず、古いartifactや架空statusで代用しない。

[Work push / watchdog手順](INTEGRATION_RESCUE_WORK.md)を正本とする。独立時計はChatGPT Workの既存タスクを使い、対応上限の1時間周期。PRイベントは通常CIから即時scanを依頼する。旧Cloudflare cronのPAT登録jobは廃止し、短命GITHUB_TOKENを外部Secretへ保存しない。旧watchdogファイルは過去の構成の資料であり、現在の有効化手順ではない。

## Scope、優先度、Wave

開始時にhead/develop/merge-baseを記録。changed filesはrename前後を含む全件、develop差分、workspace依存グラフの推移consumer、Depends-Onを取得する。PRのtitle/body/labels/対象branchもfingerprint化し、途中の目的変更を検知する。

| 判定 | 動作 |
| --- | --- |
| GREEN | 独立app/docs等を並列実行 |
| YELLOW | 同package・別file。並列可、push前後に最新developを再確認 |
| RED | 同file、shared packageとconsumer、schema/save/protocol/API contract、Integration制御面、同じ`Rescue-Spec:`/issue目的、Depends-On。先行PRがdevelopにmergeされるまで後続を待機 |

同file内の別関数も保守的にRED。意味的に同じ仕様を変更する場合はPR本文に同一`Rescue-Spec: <契約名>`、または同一Fixes/Closes対象を記す。機械的scope解析だけで全ての意味的競合を証明できないため、Workerも最新仕様と両側の目的を確認し、不確かな仕様判断はmanualへ送る。

優先度はrepair +100、依存先の数×20（上限200）、待機時間1時間につき+1（上限72）、小diff +15、共通基盤/制御/大diffの減点。根拠をstate/PULSEへ記録する。依存cycle・閉じられた未merge依存先はmanual。

REDのlockはWorker終了時に解除しない。PUSHED/RETURNED/CHECKINGも順番lockを持ち、MERGEDをGitHubから確認した次Waveで後続を救済する。実行slot自体はWorker終了で解放し、別GREEN PRに使える。

## Claim、停止、復旧

`automation/integration-rescue-state`はコードbranchと独立したorphan branch。`rescue-state.json`が正本で、Contents APIの現在blob SHAを条件に更新する。409/422の競合は最新を再読込し、有限回だけCASを再試行する。state更新関数内で外部副作用は起こさない。

claimにはrescue ID、PR、実worker ID、run ID、claimedAt、heartbeatAt、attempt/maxAttempts、head/develop/merge-baseが含まれる。全Coordinatorが同じstateへCASするため、runを跨いでも同一PRの二重claimとslot超過を防ぐ。各Worker jobにも`integration-rescue-pr-N` concurrencyを設定する。

heartbeatは120秒ごと、600秒途絶でSTALE。進行要約にはcurrentStep/currentAction/currentFileを使い、検証成功/claim/復帰の判定はAI要約で変更できない。まだ実行中のrunnerからleaseを奪わず、GitHubがrun終了を確認した場合だけ再claim可能にする。jobの45分timeoutが死んだ処理を有限化する。旧Workerはrescue ID/worker IDが一致しないとstate/pushを更新できない。

retryは300秒×attemptの待機を置く。前回run、failure reason、patch、context artifactを次Workerへ渡し、同じbranch/commitを復旧点にする。古いpatchは無条件適用しない。head/PR目的の変更は破棄・再評価。developの変更が無関係scopeなら継続し、関連scopeなら最新基準の次attemptへ移る。

browser self-healingのpending/working ticketが同じPRを担当している場合はRescueを待機し、既存repair Workerと競合させない。human-requiredはRescue側もmanualとする。manual hold、Changes requested、unresolved thread、Draft、外部PR、untrusted author、main/Productionは修復で解除しない。自動処理は`FAILED_MANUAL`を自発的に再開しない。

## 検証とIntegration復帰

同file競合や関連コードの意味判断はmanualへ送り、既存ChatGPT Workで仕様・reviewを確認する。自動base更新のwrapperは履歴不変・blob/mode保持・未解決marker・scope逸脱・assertion削除を検査する。検証後のtreeだけをGitHubへstagingし、失敗したcommitを対象branchへ反映しない。

Work push relayは実Actions job成功、staged commitのtree/parents、PR契約、head、review/thread、依存、browser repair所有権、最新developを再確認する。CASでpush予約を取得してから元PR branchだけを通常fast-forwardする。force push、history rewrite、develop直接pushは禁止。push後もGitHub headを再取得してPUSHED/RETURNEDを記録する。通常Integrationだけがmerge/DEV成功を判定する。

AWAITING_PUSHは稼働WorkerでもIntegration復帰済みでもない。RED順番lockは保持する。Work relayの予約は10分、停止したrelayは同一staged commitの実head照合で冪等復旧する。2時間未反映なら有限retryに分類する。

[実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md)の同期待機禁止は修正Workerにも適用する。RETURNED時にlease/slotを解放してWorkerを終了し、CHECKINGはCoordinatorが観測する。意味調査用のWork指示はDispatchと共通の禁止ルールを維持する。Waveの修正push成功通知は `READY_FOR_INTEGRATION` とし、通常Integrationの `INTEGRATED` / `DEV_DEPLOYED` を待ってWorkerを保持しない。既存claim・heartbeat・attempt・REDの順番lockは変更しない。

## PULSEの観測

INTEGRATION RESCUEは既存PULSE内に追加。上部のactive/max、queue、blocked、validating、returned、manual、retry、staleに加え、実worker IDのカード、短い作業要約、工程rail、scope/files、Wave、依存待ち、再試行理由、成功履歴、通常Integration/merge/DEVへの進行を表示する。

GitHub上のstate更新後に認証済みsnapshotをPULSEへ送る。これは失敗してもRescueに影響しない。既存5分collectorもETag付き1リクエストでstateを取得する。ブラウザは既存の60秒更新で保存snapshotを読むだけで、GitHubをpollしない。heartbeatの経過表示はブラウザ内で15秒ごとに計算する。取得失敗・古いsnapshotは正常ゼロとせず前回値と遅延を表示する。

直近24時間の保持イベントからRescued/Merged/Manual/Retryingを集計し、大規模DBは追加しない。activityは400件、Waveは100件、完了PR履歴は7日を上限とする。平均所要時間・完了時刻予測は作らない。stateは900KBを超えた場合fail closedし、active/manualの記録を黙って捨てない。

公開URLは `https://rinne-ops.c-okamoto.workers.dev/#rescue-section`。4並列などのfixtureは`tests/fixtures/integration-rescue-state.mjs`とローカルbrowser harnessだけに置き、本番assetに含めない。手動確認は`node ops-board/rescue-browser-check.mjs`で画面とreportを生成する。既存browser gateは維持する。

## 実行制限と資料

2026-09-13に[GitHub Actions limits](https://docs.github.com/en/actions/reference/limits)を確認。標準runnerの同時job上限はFree 20 / Pro 40（他workflowと共有）、matrix上限は256。Poolの初期4はこの共有枠に余裕を残す設定で、アカウントの空き枠を保証するものではない。GitHubのGITHUB_TOKENは通常1,000 API requests/hour/repository。Coordinatorは最大12件/160リクエスト/3分の予算を持ち、既存Integration clientのtimeout/backoffを再利用する。イベントburst時はcoordinator concurrencyとCASに加え120秒以内の再走査を集約し、REST残量200を通常Integrationとlive lease用に残す。各値はrescueConfigで一元管理する。

[GitHub workflow trigger](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)のイベント抑止と既定branch制約を維持する。公開Repositoryの標準runnerの利用条件は[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)を参照する。追加API利用枠・長期PAT・追加有料runnerは導入しない。

## CIイベント回収との境界

既存watchdogの `rescue_mode=scan` は通常Integration側のbounded queue-recoveryも起動する。cancelled CIの再実行や成功済みPRのIntegration request欠落は、branchのbase更新・意味修復ではない。回収処理はWorker claim/attempt/RED lockを変更せず、実際のfailed gateはsuccessへ書き換えない。競合・意味判断のFAILED_MANUALは従来どおり人間の判断を待つ。
