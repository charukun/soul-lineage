# Integration Rescue: existing Work push and watchdog

追加API課金なし。既存ChatGPT Work / GitHub接続で1回分の復旧を処理し、GitHubを正本に終了する。新しいモデルAPI、PAT、常駐server、独自queueは作らない。利用枠不足時に追加課金へfallbackしない。

## 読み込みと役割

毎回最新develop、AGENTS、DEVELOPMENT、INTEGRATION、INTEGRATION_RESCUE、実行ポリシーを読む。`automation/integration-rescue-state/rescue-state.json` と実PR/Actionsを再取得する。Draft・hold・Changes requested・未解決thread・browser repair所有権を維持し、FAILED_MANUALを自動解除しない。main / Productionは変更禁止。

通常実装WorkerのCI待機は禁止。このタスクはIntegrationの1回分だけを担当する。数十秒おきのpoll、watch、sleep待機はしない。実stateに未完了を記録し、次のイベント/タスクへ引き継ぐ。手順やファイルが最新developに未統合ならコードの有効化を推測せず止める。

## AWAITING_PUSHの反映

1. stateの現在blob SHAを取得。AWAITING_PUSHのrecordごとに実PR、reviews、全review threads、open browser repair issues、Depends-On、最新developと関連比較、staged git commit、実Actions run/jobs/stepsを取得する。未取得を空のreviews/threadsに置き換えない。
2. `scripts/integration-rescue-work-push.mjs` の `verifyWorkPush` を実データに適用する。Actionsの修復job終了/success、実staging step成功、commit SHA/tree/parentsと検証tree一致を必須にする。PRのbranch/head/契約・review/holdが変わったら反映しない。
3. 実WORKを識別する `work/<actual-session-or-task-run>` を使い、`claimWorkPush` を適用。state revisionを1増加、updatedAtを実時刻にし、現在blob SHA条件付きのGitHub Contents更新で保存する。409/422なら再取得し最大8回。CAS更新内でpushしない。他recordを上書きしない。
4. push直前にstate予約・PR mutable state・最新developを再取得して再検証。通常gitが利用可能ならstaged commitをfetchして同じSHAを元PRへ通常push。通常gitの認証が利用できなければ既存GitHub接続の `update_ref(branch_name=record.branch, sha=record.stagedSha, force=false)` を使う。新しいcommitやworkflow成功statusを作らない。既にhead=stagedShaなら反映は省略し完了記録だけ復旧する。
5. GitHub headと安全条件を再取得。`finishWorkPush` を現在stateへ適用しCAS保存する。これがPUSHED → RETURNED_TO_INTEGRATIONの実証。元PRの通常CIから通常Integrationへ流す。実claim/heartbeat/attempt/Worker IDを過去のfixtureで埋めない。
6. PRコメントに実Worker/attempt/staged/push SHA/実Actions runとREADY_FOR_INTEGRATIONを記録する。成功通知はDEV成功と区別する。送信済みmarkerで冪等にする。

`pushLease`は10分で再予約可能。古いWorkは最後のCAS fenceを再読込しない限りpushしない。fast-forwardのみなので、第三者が先に別commitへ進めたbranchを巻き戻さない。staged commitと同じheadは二重pushせずstateのみ復旧する。安全条件が不明ならFAILED/理由を残す。

## 独立watchdogの1回分

既存PRのReady/synchronize/reviewイベントは通常CIの `Request Rescue observation` から `deploy.yml ref=develop rescue_mode=scan` を起動する。競合PRのイベント欠落・死亡Worker・滞留queueはWorkの1時間周期の復旧タスクで補完する。これはWorkの対応する最短周期であり、10分監視と表示しない。

- 実state/coordinator heartbeatと現在Actionsを1回取得。進行中scanがあれば新しいscanを重複起動しない。
- 明示dispatchツール/通常ghが利用できれば `deploy.yml ref=develop rescue_mode=scan` を1回起動する。
- 現在のGitHub接続にdispatch操作が無い場合は、**実際に取得した**同RepositoryのCI run内の `Request Rescue observation` jobを `rerun_workflow_job` で1回だけ再実行する。このjobはtrusted developをcheckoutし、標準GITHUB_TOKENで既存scan入口をdispatchする。GitHubから返ったjob IDを使い、推測しない。最新のdevelop向けReady PRのrunを優先。別jobやProduction runは再実行しない。
- 同じjobを新しいイベントなしで反復retryしない。起動不能はGitHubにFAILED/原因/次の経路を残す。認証が使える場合のGitHub Actions UIでのref=develop手動dispatchも既存の復旧経路。
- AWAITING_PUSHを上記手順で処理。未完了CIは待たない。Coordinator/ReturnがmergeとDEVを追跡する。PULSE `/api/state` とGitHub stateの時刻/Worker/queue/retry/manual/stale/staged/push/merge/DEVを照合し、観測遅延を成功ゼロで隠さない。
- 既存外部通知先が利用できれば実結果を通知。ntfy未設定、送信失敗、スマホ到達未確認を別々に記録し、ChatGPTアプリ通知を外部到達と扱わない。

通常pushと独立scanが実行できることを実稼働受入で確認するまで、この文書とタスク登録だけでSUCCESSとしない。
