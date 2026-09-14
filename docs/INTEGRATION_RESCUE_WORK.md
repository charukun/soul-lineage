# Integration Rescue: existing Work push and watchdog

## Workによる競合修復の自動引き継ぎ（導入範囲）

ユーザーの継続的な依頼に基づき、既存の定期Workへ、Actionsが同file競合で停止したPRの仕様確認と修復を追加する。
対象は `FAILED_MANUAL:SEMANTIC_CONFLICT` のうち、最新の確定仕様と両側の変更目的を両立できるもの。
明示hold・review・未解決thread・browser repair所有権・追加API課金禁止は維持する。
既存rescue-state上のCAS予約と有限attemptを使い、元PRを修復して通常Integrationへ戻す。
仕様を決められない案件はその理由を記録して停止し、同じheadを繰り返し修復しない。
導入コードがdevelopへ統合されるまで、定期Workはこの修復経路を実稼働させない。

追加API課金なし。既存ChatGPT Work / GitHub接続で1回分の復旧を処理し、GitHubを正本に終了する。新しいモデルAPI、PAT、常駐server、独自queueは作らない。利用枠不足時に追加課金へfallbackしない。

## 読み込みと役割

毎回最新develop、AGENTS、DEVELOPMENT、INTEGRATION、INTEGRATION_RESCUE、実行ポリシーを読む。`automation/integration-rescue-state/rescue-state.json` と実PR/Actionsを再取得する。Draft・hold・Changes requested・未解決thread・browser repair所有権を維持し、FAILED_MANUALは下記のWork競合修復条件を満たすものだけ扱い、他の停止理由を自動解除しない。main / Productionは変更禁止。

通常実装WorkerのCI待機は禁止。このタスクはIntegrationの1回分だけを担当する。数十秒おきのpoll、watch、sleep待機はしない。実stateに未完了を記録し、次のイベント/タスクへ引き継ぐ。手順やファイルが最新developに未統合ならコードの有効化を推測せず止める。

この未統合gateは、定期復旧タスクがclaim・pushなどの実稼働操作を行う前提条件。導入PR自体の実装・検証・push・Ready化を停止する条件ではない。導入PRは通常の実装手順で仕上げ、trusted Integrationのレビュー・CIを経て統合する。定期タスクの条件を緩めて未統合コードを実稼働させない。

## AWAITING_PUSHの反映

1. stateの現在blob SHAを取得。AWAITING_PUSHのrecordごとに実PR、reviews、全review threads、open browser repair issues、Depends-On、最新developと関連比較、staged git commit、実Actions run/jobs/stepsを取得する。未取得を空のreviews/threadsに置き換えない。
2. `scripts/integration-rescue-work-push.mjs` の `verifyWorkPush` を実データに適用する。Actionsの修復job終了/success、実staging step成功、commit SHA/tree/parentsと検証tree一致を必須にする。PRのbranch/head/契約・review/holdが変わったら反映しない。
3. 実WORKを識別する `work/<actual-session-or-task-run>` を使い、`claimWorkPush` を適用。state revisionを1増加、updatedAtを実時刻にし、現在blob SHA条件付きのGitHub Contents更新で保存する。409/422なら再取得し最大8回。CAS更新内でpushしない。他recordを上書きしない。
4. push直前にstate予約・PR mutable state・最新developを再取得して再検証。通常gitが利用可能ならstaged commitをfetchして同じSHAを元PRへ通常push。通常gitの認証が利用できなければ既存GitHub接続の `update_ref(branch_name=record.branch, sha=record.stagedSha, force=false)` を使う。新しいcommitやworkflow成功statusを作らない。既にhead=stagedShaなら反映は省略し完了記録だけ復旧する。
5. GitHub headと安全条件を再取得。`finishWorkPush` を現在stateへ適用しCAS保存する。これがPUSHED → RETURNED_TO_INTEGRATIONの実証。元PRの通常CIから通常Integrationへ流す。実claim/heartbeat/attempt/Worker IDを過去のfixtureで埋めない。
6. PRコメントに実Worker/attempt/staged/push SHA/実Actions runとREADY_FOR_INTEGRATIONを記録する。成功通知はDEV成功と区別する。送信済みmarkerで冪等にする。

`pushLease`は10分で再予約可能。古いWorkは最後のCAS fenceを再読込しない限りpushしない。fast-forwardのみなので、第三者が先に別commitへ進めたbranchを巻き戻さない。staged commitと同じheadは二重pushせずstateのみ復旧する。安全条件が不明ならFAILED/理由を残す。

## Throughput v2: fast evidenceと優先復帰

PR #167のWork競合修復を前提に、Rescueから通常Integrationへ戻る交通整理だけを高速化する。

- Actions safe base-update Workerが `npm ci + trusted validate.mjs fast` を成功させた場合、push後CIはtrusted develop側の `scripts/integration-rescue-fast-evidence.mjs` で rescue-state、exact commit tree、2 parents、実Actions run/job/step、同runのartifactを再取得する。すべて一致した時だけ同じfast検証を再利用する。
- 再利用しても `Affected browser smoke`、review、未解決thread、hold、Depends-On、mergeability、develop baseline、Integration最終exact-head gateは省略しない。証拠欠落、head不一致、artifact期限切れ、Semantic Workが編集したheadは通常fastへfallbackする。
- `RETURNED_TO_INTEGRATION` / `CHECKING` のexact headを通常Ready一覧の先頭へ寄せる。Rescue stateを読めない場合は最適化を捨て、従来の作成順へfail-safe fallbackする。
- `PR_CONTRACT_CHANGED`、`HEAD_CHANGED`、`RELATED_DEVELOP_ADVANCED`、`DEPENDENCY_NOT_MERGED`は修復ロジック失敗ではない観測競合なので、診断履歴は残すがActions attemptを消費せず次scanへ戻す。validation失敗やWorker死亡など実作業失敗は従来どおりattemptとbounded backoffを消費する。
- Actions poolは6並列、1scan最大24件、scan最短60秒、retry基準120秒へ調整する。API reserve、CAS、PR単位concurrency、Work repair scope lock、maxAttemptsは維持する。

## 独立watchdogの1回分

既存PRのReady/synchronize/reviewイベントは通常CIの `Request Rescue observation` から `deploy.yml ref=develop rescue_mode=scan` を起動する。競合PRのイベント欠落・死亡Worker・滞留queueはWorkの1時間周期の復旧タスクで補完する。これはWorkの対応する最短周期であり、10分監視と表示しない。

- 実state/coordinator heartbeatと現在Actionsを1回取得。進行中scanがあれば新しいscanを重複起動しない。
- 明示dispatchツール/通常ghが利用できれば `deploy.yml ref=develop rescue_mode=scan` を1回起動する。
- 現在のGitHub接続にdispatch操作が無い場合は、**実際に取得した**同RepositoryのCI run内の `Request Rescue observation` jobを `rerun_workflow_job` で1回だけ再実行する。このjobはtrusted developをcheckoutし、標準GITHUB_TOKENで既存scan入口をdispatchする。GitHubから返ったjob IDを使い、推測しない。最新のdevelop向けReady PRのrunを優先。別jobやProduction runは再実行しない。
- 同じjobを新しいイベントなしで反復retryしない。起動不能はGitHubにFAILED/原因/次の経路を残す。認証が使える場合のGitHub Actions UIでのref=develop手動dispatchも既存の復旧経路。
- AWAITING_PUSHを上記手順で処理。未完了CIは待たない。Coordinator/ReturnがmergeとDEVを追跡する。PULSE `/api/state` とGitHub stateの時刻/Worker/queue/retry/manual/stale/staged/push/merge/DEVを照合し、観測遅延を成功ゼロで隠さない。
- 既存外部通知先が利用できれば実結果を通知。ntfy未設定、送信失敗、スマホ到達未確認を別々に記録し、ChatGPTアプリ通知を外部到達と扱わない。

通常pushと独立scanが実行できることを実稼働受入で確認するまで、この文書とタスク登録だけでSUCCESSとしない。

## SEMANTIC_CONFLICTを既存Workへ引き継ぐ

`FAILED_MANUAL:SEMANTIC_CONFLICT` はActionsが同file変更を保守的に拒否した印であり、直ちにプロダクト判断が必要と確定した意味ではない。ユーザーはこの種の修復を既存Workへ自動で引き継ぐことを許可している。新しいモデルAPI・専用常駐Workerは使わず、既存の1時間周期タスクに次の1回分を追加する。

1. 最新developの `scripts/integration-rescue-work-repair.mjs` を読む。未統合ならこの経路のみ停止し、既存push relay/watchdogは続ける。未レビューのPR版を自動修復の権限として実行しない。
2. 対象PRはopen/Ready/develop/同Repository/trusted author、停止理由は上記SEMANTIC_CONFLICTだけ。実PRの完全な情報（author_associationとlabelsを含む）、reviews/全threads、open browser repair issues、全変更file（rename前後）、最新develop、Depends-Onの実PRを取得する。取得できないものを空配列や推測で補わない。
3. 前回Workのpush結果がstateにあり実headが一致する場合、`recoverWorkRepair` で受領記録だけ復旧する。期限切れ予約は `expireWorkRepair` でslotを解放する。成功やattemptリセットにはしない。次に `verifyWorkRepair` → `claimWorkRepair` を実データへ適用し、現在blob SHA条件付きCASで保存する。実session/run由来の `work/<id>` を使う。1回最大1PR、同file/関連packageの処理中Work・ActionsやIntegration返却済みPRと並行しない。
4. 元PR branchと最新developを取得し、両方の確定仕様・diff・関連テストを読む。予約は `record.workRepair` に保持され、ActionsのFAILED_MANUALは解除せず解析中のままにする。45分の予約を持ち、作業中は120秒程度ごとに `heartbeatWorkRepair` をCAS保存する。Ready PRに未検証の途中コードをpushしない。
5. 両側の目的を保てる場合だけ元branchでmerge競合を修正する。機械的なours/theirs全採用や無条件cherry-pickは禁止。元PRの変更fileと同じapp/package内の関連テストだけを修正対象にする。仕様の根拠となるPR head/developのSHA・文書path、両立方針を `decision.sources` / `summary` に残す。save/schema/protocol、control、review/hold、browser repair所有権、真の仕様矛盾は自動で決めない。
6. npm ciとtrusted fast検証を行い、未解決marker・scope・treeを確認する。最終commitは元PR headと検証したdevelopを両親に持つmerge commitにする。GitHub APIならdevelop treeに修復差分を適用しlocal treeと一致を確認する。全変更pathはdevelopと最終treeの差分から取得する。
7. stateの最新予約とPR/review/所有権/developを再取得。`prepareWorkRepairPush` に実commit/tree/parents、検証結果、完全な変更path一覧、仕様判断の根拠を渡してCAS保存する。push前に再びfenceを確認する。通常git → 接続GitHub API（force=false）→ Codespacesの順で同じ元PR branchへ反映する。第三者が進めたheadを上書きしない。
8. 実headを再取得し `finishWorkRepair` をCAS保存する。これでRETURNED_TO_INTEGRATIONへ戻り、通常CI/Integrationが継続する。PR本文を更新するのは受領記録後に行う（契約fingerprintを途中で変更しない）。既存Ready PRの新headをREADY_FOR_INTEGRATIONとして報告し、CI/browser/DEV完了を待たず終了する。
9. 仕様を両立できない場合は `stopWorkRepair(humanRequired:true)` で具体的な論点を残す。同じ案件を定期タスクが再試行せず、ユーザーの新しい判断を待つ。通信など一時的な失敗は `humanRequired:false` とし、元のmaxAttemptsの範囲だけ次回対象にする。予約失効・第三者変更でfenceを失った旧Workerは書き込まない。

この経路は人間の明示hold、Changes requested、未解決thread、human-required、attempt上限を解除しない。成功status/reviewを作らず、main/Productionへpush・mergeしない。通常Integrationのexact-headレビューとfast/browser gateは従来どおり必須。タスク設定更新と実行成功は区別し、最初の定期修復の成功は実PR/head/stateで確認する。
