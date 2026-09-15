# Integration Rescue: existing Work push and watchdog

## WorkによるFAILED_MANUAL修復の自動引き継ぎ（導入範囲）

ユーザーの継続的な依頼に基づき、既存の定期Workへ、Actionsの保守的な安全停止のうちAIによる仕様照合と検証で解消できる `FAILED_MANUAL` の修復を追加する。
対象可否は最新developの `scripts/integration-rescue-work-repair.mjs` にある `workRepairEligibility(record)` を正本とし、prompt側へ理由一覧を複製しない。現行実装は `SEMANTIC_CONFLICT`、`OVERLAPPING_CHANGES`、`RELATED_CODE_RECONCILIATION`、安全条件を満たすcontrol-plane reconciliation、`ASSERTION_REMOVAL`、git tree staging HTTP 422等のrecoverable transport停止をWorkへ引き継げる。
明示hold・Changes requested・未解決thread・browser repair所有権・data/save/schema/protocol契約の真の選択・追加API課金禁止は維持する。`contract` と判定されたpathはWorkが調査してよいが、互換性維持かつプロダクト判断不要を証明できない限りpushしない。assertion削除停止もテスト網羅性維持と削除assertionの再調停を証明できる場合だけ復旧する。
Actions側attemptと独立した有限 `workRepairAttempts` を使い、元PRを修復して通常Integrationへ戻す。仕様を決められない案件はhuman-requiredとして具体的理由を残し、同じheadを無限再試行しない。

仕様判断の範囲は [DEVで実物を確認する標準開発](RINNE_PROJECT_EXECUTION_POLICY.md#devで実物を確認する標準開発) に従う。確定仕様への適応と可逆的な細部はAIへ委任済みであり、それだけでhuman-requiredにしない。以下の `noProductChoiceRequired` は、委任範囲外の未解決の契約選択がないことを示す証拠として扱い、互換性・gate・網羅性の証明を省略しない。
導入コードがdevelopへ統合されるまで、定期Workはこの修復経路を実稼働させない。

追加API課金なし。既存ChatGPT Work / GitHub接続で1回分の復旧を処理し、GitHubを正本に終了する。新しいモデルAPI、PAT、常駐server、独自queueは作らない。利用枠不足時に追加課金へfallbackしない。

## 読み込みと役割

毎回最新develop、AGENTS、DEVELOPMENT、INTEGRATION、INTEGRATION_RESCUE、実行ポリシーを読む。`automation/integration-rescue-state/rescue-state.json` と実PR/Actionsを再取得する。Draft・hold・Changes requested・未解決thread・browser repair所有権を維持し、FAILED_MANUALは統合済みhelperのWork修復条件を満たすものだけ扱う。main / Productionは変更禁止。

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

## 独立watchdogの1回分

既存PRのReady/synchronize/reviewイベントは通常CIの `Request Rescue observation` から `deploy.yml ref=develop rescue_mode=scan` を起動する。競合PRのイベント欠落・死亡Worker・滞留queueはWorkの1時間周期の復旧タスクで補完する。これはWorkの対応する最短周期であり、10分監視と表示しない。

- 実state/coordinator heartbeatと現在Actionsを1回取得。進行中scanがあれば新しいscanを重複起動しない。
- 明示dispatchツール/通常ghが利用できれば `deploy.yml ref=develop rescue_mode=scan` を1回起動する。
- 現在のGitHub接続にdispatch操作が無い場合は、**実際に取得した**同RepositoryのCI run内の `Request Rescue observation` jobを `rerun_workflow_job` で1回だけ再実行する。このjobはtrusted developをcheckoutし、標準GITHUB_TOKENで既存scan入口をdispatchする。GitHubから返ったjob IDを使い、推測しない。最新のdevelop向けReady PRのrunを優先。別jobやProduction runは再実行しない。
- 同じjobを新しいイベントなしで反復retryしない。起動不能はGitHubにFAILED/原因/次の経路を残す。認証が使える場合のGitHub Actions UIでのref=develop手動dispatchも既存の復旧経路。
- AWAITING_PUSHを上記手順で処理。未完了CIは待たない。Coordinator/ReturnがmergeとDEVを追跡する。PULSE `/api/state` とGitHub stateの時刻/Worker/queue/retry/manual/stale/staged/push/merge/DEVを照合し、観測遅延を成功ゼロで隠さない。
- 既存外部通知先が利用できれば実結果を通知。ntfy未設定、送信失敗、スマホ到達未確認を別々に記録し、ChatGPTアプリ通知を外部到達と扱わない。

通常pushと独立scanが実行できることを実稼働受入で確認するまで、この文書とタスク登録だけでSUCCESSとしない。

## Recoverable FAILED_MANUALを既存Workへ引き継ぐ

`FAILED_MANUAL` は必ずしも「ユーザーがコードを手修正する必要がある」という意味ではない。Actionsが安全側へ倒して止めた案件のうち、両側の確定仕様を参照し、検証済みmerge commitを作れるものは既存Workへ自動で引き継ぐ。対象の唯一の機械判定は `workRepairEligibility(record)` とし、定期タスク自身がreasonの正規表現を再実装しない。

1. 最新developの `scripts/integration-rescue-work-repair.mjs` を読む。未統合ならこの経路のみ停止し、既存push relay/watchdogは続ける。未レビューのPR版を自動修復の権限として実行しない。
2. 対象PRはopen/Ready/develop/同Repository/trusted authorで、`workRepairEligibility(record).eligible === true` のものだけ。実PRの完全な情報（author_associationとlabelsを含む）、reviews/全threads、open browser repair issues、全変更file（rename前後）、最新develop、Depends-Onの実PRを取得する。取得できないものを空配列や推測で補わない。
3. 前回Workのpush結果がstateにあり実headが一致する場合、`recoverWorkRepair` で受領記録だけ復旧する。期限切れ予約は `expireWorkRepair` でslotを解放する。次に `verifyWorkRepair` → `claimWorkRepair` を実データへ適用し、現在blob SHA条件付きCASで保存する。実session/run由来の `work/<id>` を使う。Actions attemptは変更せず、Work用の独立 `workRepairAttempts` を有限に消費する。
4. 1回の定期Workで最大4PRまで扱える。ただし `state.config.maxConcurrency`、同file/関連packageのRED lock、処理中Work・Actions・Integration返却済みPRの所有権を必ず守る。安全に並列化できない場合は逐次処理し、残りを次回へ渡す。
5. 元PR branchと最新developを取得し、両方の確定仕様・diff・関連テストを読む。予約は `record.workRepair` に保持され、ActionsのFAILED_MANUALを先に解除しない。45分の予約を持ち、作業中は必要に応じ `heartbeatWorkRepair` をCAS保存する。Ready PRに未検証の途中コードをpushしない。
6. 両側の目的を保てる場合だけ元branchで競合・重複・関連コード差分を修正する。機械的なours/theirs全採用や無条件cherry-pickは禁止。元PRの変更fileと同scopeの関連テストだけを修正対象にする。仕様の根拠となるPR head/developのSHA・文書path、両立方針を `decision.sources` / `summary` に残す。
7. control-plane fileを含む場合は、AGENTS / DEVELOPMENT / INTEGRATION等のgoverning sourceを実際に確認する。既存gateを維持したと証明できる場合だけ `decision.controlReview.preservesGates=true` と `governingSources` を記録して進める。`contract` scopeは調査自体を禁止せず、既存互換性を維持しプロダクト上の選択が不要と証明できる場合だけ `decision.contractReview.noProductChoiceRequired=true`、`preservesCompatibility=true`、`governingSources` を記録して進める。schema/save/protocol等で真の契約選択が必要ならhuman-requiredへ送る。`ASSERTION_REMOVAL` は、削除されたassertionの意図を再調停しテスト網羅性を落としていないことを確認し、`decision.assertionReview.preservesCoverage=true`、`removedAssertionsReconciled=true`、`governingTests` を記録できる場合だけ進める。成功statusの捏造、review/holdの解除、CI/browser条件の弱体化は禁止。
8. npm ciとtrusted fast検証を行い、未解決marker・scope・treeを確認する。最終commitは元PR headと検証したdevelopを両親に持つmerge commitにする。GitHub APIならdevelop treeに修復差分を適用しlocal treeと一致を確認する。全変更pathはdevelopと最終treeの差分から取得する。
9. stateの最新予約とPR/review/所有権/developを再取得。`prepareWorkRepairPush` に実commit/tree/parents、検証結果、完全な変更path一覧、仕様判断の根拠を渡してCAS保存する。push前に再びfenceを確認する。通常git → 接続GitHub API（force=false）→ Codespacesの順で同じ元PR branchへ反映する。第三者が進めたheadを上書きしない。
10. 実headを再取得し `finishWorkRepair` をCAS保存する。これでRETURNED_TO_INTEGRATIONへ戻り、通常CI/Integrationが継続する。PR本文を更新するのは受領記録後に行う（契約fingerprintを途中で変更しない）。既存Ready PRの新headをREADY_FOR_INTEGRATIONとして報告し、CI/browser/DEV完了を待たず終了する。
11. 仕様を両立できない真のプロダクト判断は `stopWorkRepair(humanRequired:true)` で具体的な論点を残す。一時的な通信・実行障害は `humanRequired:false` とし、独立した `workRepairAttempts` の有限上限だけ次回対象にする。予約失効・第三者変更でfenceを失った旧Workerは書き込まない。

この経路は人間の明示hold、Changes requested、未解決thread、human-required、data/save/schema/protocol契約の意思決定を自動解除しない。契約名を含むpathやassertion削除停止は調査対象にできるが、互換性・網羅性・プロダクト判断不要の証明なしにpushしない。Actions attempt上限はWork escalationを永久停止させる理由にしないが、Work側も独立上限を持つ。成功status/reviewを作らず、main/Productionへpush・mergeしない。通常Integrationのexact-headレビューとfast/browser gateは従来どおり必須。タスク設定更新と実修復成功は区別し、最初の定期修復の成功は実PR/head/stateで確認する。
