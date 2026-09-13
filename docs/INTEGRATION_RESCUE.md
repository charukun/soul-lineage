# Integration Rescue

Ready PRが修復可能な理由で停止したとき、Coordinatorが変更領域と依存順を判定し、独立Actions jobのWorker Poolへ配分する。修復先は元PR branchだけ。通常Integrationのexact-head checks、review、未解決thread、Depends-On、develop baseline、merge直前再検証、bounded merge、DEV公開は維持する。

## 実装と責任

| 構成 | 実装 | 責任 |
| --- | --- | --- |
| Coordinator | `scripts/integration-rescue-coordinator.mjs` | GitHub再取得、対象判定、優先度、依存・scope比較、Wave/slot/claim、死亡検知 |
| Policy | `scripts/integration-rescue-policy.mjs` | 純粋な状態遷移、GREEN/YELLOW/RED、snapshot再評価 |
| Durable state | `scripts/integration-rescue-store.mjs` | GitHub Contents APIのblob SHA条件付き更新によるCAS |
| Worker Pool | `.github/workflows/integration-rescue.yml` | dynamic matrix、独立runner/checkout、PR単位concurrency |
| Semantic worker | `scripts/integration-rescue-worker.mjs` | 現行APIへPR目的を移植、信頼済みwrapperの検証、通常push |
| Return / notification | `scripts/integration-rescue-return.mjs` | 通常Integrationへ集約dispatch、merge/DEV追跡、通知outbox |
| Independent watchdog | `scripts/integration-rescue-watchdog-worker.mjs` | PULSEと別のCloudflare Workerが10分ごとに既存deploy workflowを起動 |
| PULSE | `ops-board/rescue.mjs`, `public/rescue-board.*` | GitHub stateの観測ビュー。制御やmerge権限は持たない |

## 起動経路と既定branch制約

既定branchはmain。今回mainは変更しない。新設workflowの`workflow_dispatch`、`schedule`、`workflow_run`、`repository_dispatch`が既定branch上に存在するという前提を置かない。

既定branchにも存在する`deploy.yml`を`ref: develop`で起動し、develop側の新しい`rescue_mode: scan`入力でRescue専用走査を行う。このmodeではmerge/deploy jobを起動しない。通常のdevelop pushおよびIntegration実行後も同じreusable Rescue workflowへ接続する。CIのReady/synchronize/review等のPRイベントは短い`Request Rescue observation`からこの既存経路を起動する。

競合PRでは`pull_request` workflow自体が起動しないことがあるため、独立Cloudflare cronがイベント欠落・worker死亡・孤立queueを再走査する。PULSEを閉じても、PULSE自体が停止してもcronとRescueは継続する。scopeはGitHub上で再取得し、外部cronへPRコードやAIログを渡さない。

Worker終了時は同じWaveの他Workerを待たず通常Integrationへの復帰を依頼する。復帰dispatchはstate上の短いleaseで重複予約を防止。自己dispatchは未送信の復帰headがある場合のみで、同じheadの送信済み記録から再発火しない。進展のないqueueはcronで有限retryし、無限自己dispatchしない。

## 設定と有効化

| 設定 | 既定値 / 用途 |
| --- | --- |
| Repository variable `MAX_RESCUE_CONCURRENCY` | 4。1〜16で設定可能。全run合計のclaim上限とmatrix max-parallel |
| Repository variable `MAX_RESCUE_ATTEMPTS` | 3。1〜10で設定可能。PR単位の累計上限 |
| Secret `OPENAI_API_KEY` | RINNE Dispatchと同じ公式Codex Action用API資格情報 |
| Secret `RESCUE_GITHUB_TOKEN` | 同Repositoryへ通常pushしCIイベントを発火できるfine-grained PAT等。Contents/Actions write、PR/Issues read。組織の権限ポリシーに従う |
| Variable `RINNE_CODEX_MODEL` | Dispatchと同じ任意model指定。空なら公式Actionの既定 |
| Existing `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | PULSE観測更新と独立watchdogの公開 |
| Optional `NTFY_TOPIC_URL`, `NTFY_TOKEN` | 既存ntfy topicへmanual即時・Wave集約通知 |

WorkerへAIキー/書込みtokenを渡すのはwrapper/公式Actionのみ。PRコードを実行するnpm/testsの子processから秘密環境変数を除外する。AIは別の非特権OSユーザーとして`work/`だけを編集し、root所有・書込み不可の`control/`にある検証wrapperを変更できない。PR checkoutは`persist-credentials: false`。push tokenはpush直前のgit子process環境にだけ設定し、git config/コマンド引数へ保存しない。

`GITHUB_TOKEN`だけのpushは通常のPR CIを再発火しない。そのためevent-capable push tokenを必須とし、架空のCI成功statusや古いfast artifactで代用しない。AI/push資格情報が無い場合はPULSEを`CONFIGURATION_REQUIRED`としてWorker起動を止める。資格情報の設定を「実装済み」から推測しない。

この変更はReady PRで引き渡す。develop統合後、PULSE workflowが独立watchdogを公開しtokenをWorker Secretとして登録する。token未設定なら明示warningを残す。設定追加後はdevelopの既存`ops-board.yml`を再実行する。稼働確認はPULSEのRescue状態とActionsの`Plan Rescue Wave` / `Rescue PR N` jobを正本にする。

RINNE Dispatchは調査時点でPR #105にあり未統合だったため、そのコードへの依存や取り込みは作らず、同じ公式Action/設定名を再利用した。developにはtask-start markerとbrowser repair通知の契約があるが、ntfy送信/watchdogの実装は確認できなかった。Rescueはその実行状態をGitHubに補完し、既存契約を置き換えない。

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

単純なours/theirsではなく、現行developのinterfaceを維持しながらPRの目的を移植する。公式Codex Actionはworking treeだけを編集し、信頼済みwrapperが履歴不変・未解決marker・scope逸脱・assertion削除を検査する。validation制御自体の意味的な書換えが必要な競合はmanualにする。

wrapperは非commit mergeの結果を通常commitし、`npm ci`と信頼済み`validate.mjs fast`を実行する。テストで変更されたworking treeをpushしない。push直前にhead、review/thread、依存、PR契約、最新developを再確認し、元PR branchへ通常fast-forward pushする。force push、history rewrite、develop直接pushは禁止。

push後にGitHub headを再取得してPUSHEDを記録し、最新developを再評価してRETURNEDへ進める。通常Integrationへの再評価要求はexact-head fast artifactもreviewも作成しない。source変更なしのqueue復旧も同じ通常ゲートへ戻す。復帰後の滞留も上限付きretry対象で、merge/DEV成功とpush成功を区別する。

## PULSEの観測

INTEGRATION RESCUEは既存PULSE内に追加。上部のactive/max、queue、blocked、validating、returned、manual、retry、staleに加え、実worker IDのカード、短い作業要約、工程rail、scope/files、Wave、依存待ち、再試行理由、成功履歴、通常Integration/merge/DEVへの進行を表示する。

GitHub上のstate更新後に認証済みsnapshotをPULSEへ送る。これは失敗してもRescueに影響しない。既存5分collectorもETag付き1リクエストでstateを取得する。ブラウザは既存の60秒更新で保存snapshotを読むだけで、GitHubをpollしない。heartbeatの経過表示はブラウザ内で15秒ごとに計算する。取得失敗・古いsnapshotは正常ゼロとせず前回値と遅延を表示する。

直近24時間の保持イベントからRescued/Merged/Manual/Retryingを集計し、大規模DBは追加しない。activityは400件、Waveは100件、完了PR履歴は7日を上限とする。平均所要時間・完了時刻予測は作らない。stateは900KBを超えた場合fail closedし、active/manualの記録を黙って捨てない。

公開URLは `https://rinne-ops.c-okamoto.workers.dev/#rescue-section`。4並列などのfixtureは`tests/fixtures/integration-rescue-state.mjs`とローカルbrowser harnessだけに置き、本番assetに含めない。手動確認は`node ops-board/rescue-browser-check.mjs`で画面とreportを生成する。既存browser gateは維持する。

## 実行制限と資料

2026-09-13に[GitHub Actions limits](https://docs.github.com/en/actions/reference/limits)を確認。標準runnerの同時job上限はFree 20 / Pro 40（他workflowと共有）、matrix上限は256。Poolの初期4はこの共有枠に余裕を残す設定で、アカウントの空き枠を保証するものではない。GitHubのGITHUB_TOKENは通常1,000 API requests/hour/repository。Coordinatorは最大12件/160リクエスト/3分の予算を持ち、既存Integration clientのtimeout/backoffを再利用する。イベントburst時はcoordinator concurrencyとCASに加え120秒以内の再走査を集約し、REST残量200を通常Integrationとlive lease用に残す。各値はrescueConfigで一元管理する。

[GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)の既定branch制約と[公式Codex Action](https://github.com/openai/codex-action)のAPI key・非特権実行を踏まえた構成。AI側の実同時実行数はAPI projectのrate/token制限にも依存する。429/quota/timeoutは診断付き有限retryとし、ChatGPTの契約だけからAPI利用枠があるとは判定しない。
