# Integration Deep Repair Handoff

Fast Laneは通常Ready PRの唯一のmerge入口であり、Fast RepairはGitで機械的に安全なmerge-forwardだけを処理する。

Fast Laneが真のmerge conflictまたはcurrent exact-headのCI failureを検出した場合、旧Rescue queueや1時間watchdogを通常の起動条件にせず、そのcurrent exact headに対するDeep Repair handoffを同じIntegration passで即時に記録する。large-base reconciliationはcomplete fail-closed comparisonでFast Laneに残し、サイズだけを理由にDeep Repairへ落とさない。

## Repository側の即時handoff

Deep Repair handoffは次を満たす。

- GitHub current stateだけを正本にし、PR番号、branch、exact head、current develop、reasonを固定する。
- `integration/deep-repair` statusと `integration-deep-repair:v1` machine-readable Issueを即時に作る。
- Issueには既存 `rinne-ai-repair:v1` envelopeも含め、既存Work repair契約と同じ座標・安全条件を渡す。
- exact headごとの `sourceKey` で冪等化し、同じheadをFast Laneが再評価してもIssueを重複生成しない。
- explicit hold、Changes requested、未解決thread、未merge dependency、external PR、main / Productionを自動修復へ送らない。
- Deep Repair自身はmerge権限を持たない。元PR branchをfast-forwardで修復し、fast validation後に同じFast Laneへ戻す。
- OpenAI API、Codex Action、専用PAT、有料fallbackを通常Deep Repair起動条件に追加しない。
- 旧periodic Work/watchdogは取りこぼし復旧のfallbackとして残してよいが、Deep Repair要求の発見や状態生成を担当しない。

Fast Repair可能な `behind` / dependency追従は従来どおり軽量executorで処理し、Deep Repair Issueを作らない。

Deep Repairは人への差し戻しと同義ではない。[実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md#devで実物を確認する標準開発) に従い、確定仕様への適応と可逆的な実装判断をAIが行い、通常gateを通してDEV公開後のユーザーフィードバックへつなぐ。同file競合・技術的難しさ・目視未確認だけでhuman-requiredにしない。仕様判断で止める場合は、根拠の契約、互換修復の検討結果、可逆的なDEV候補では解決できない理由と必要な判断を残す。

## ChatGPT Work GitHub event trigger

WorkのGitHub triggerはPR opened / ready_for_review / closedに対応し、synchronizeとhuman reviewを追加選択できる。Issue opened/edited、CI completed、botのPRコメントは起動条件にできない。Issue発行だけで自動修復が稼働していると扱わない。

通常起動は `charukun/soul-lineage` のPR event triggerを1つ登録し、`enable_commit_updates=true`・`enable_reviews=true` とする。IssueのsourceKey/state/attemptを修復の正本として維持し、PR eventはIntegration担当を起こす信号にだけ使う。Draft/外部PR/main/Productionは対象外。closed eventでは新たにdependencyを満たしたReady PRを再評価する。

Ready/更新eventはCI結果より早く届くため、ここから起動するWORKは**Integration役**として当該current headのValidate and buildを有限に確認する。観測は最大15分、API取得間隔は最低60秒、1回のtool waitは60秒以下とし、独立した処理可能PRを先に進める。head変更時は旧観測を停止する。期限超過を成功扱いせず既存PR/Issueへ記録する。通常の実装WORKは引き続きReadyで終了し、修復担当も修復push後は次のevent/Fast Laneへ返す。

RepositoryのFast Laneが作成した修復Issueを再取得し、open・pending・attempt<maxAttempts・source PR/head一致・hold/review/thread/dependencyを確認する。着手可能なら同じIssueをclaimして実際の修復に進む。現PR/headの失敗が確定してIssueがまだない場合だけ、current developのhandoff契約で冪等に作成する。他のworking claim、closed、human-required、試行上限を新しいIssueで迂回しない。

旧Integration Rescueの定期タスクは、旧queue/Work relayを走らせず、現Ready PRとDeep Repair Issueを読む取りこぼし回収へ更新する。通常起動はPR event、1時間のfallbackはevent取りこぼし・有限観測の期限超過だけを回収する。新しいTask-ID/queue/DB、有料API/PATは追加しない。アカウント側のtrigger登録と有効化はRepository外の設定なので、文書追加だけで設定済みとは報告しない。

Workerの実行契約は次のとおり。

- latest develop・AGENTS・Integration/実行ポリシーを読み、現在のPR/head/Issueを再取得する。
- pendingからworkingへ変更しattemptを1増やしてclaimedBy/claimedAt/repairDevelopを記録し、再取得で自分のclaimを確認する。他のclaimを奪わない。
- 両側の確定仕様と差分を読み、元PR branchへ互換修復する。無条件ours/theirs、assertion削除、hold/review/thread解除、force pushは禁止。
- fast validationとpushするsource treeの同一性を確認する。merge-forwardは元headと検証したdevelopを両親に持つcommitとする。
- push後はIssueへrepairHead・検証結果・ready-for-integrationを記録し、既存single-writer Fast Laneへ戻す。独自の成功statusや自己承認でreview gateを通さない。
- 古いhuman-requiredは現仕様・現在の権限・残attemptを個別に再評価し、適応できる根拠なしに解除しない。
- 登録成功、実起動、claim、修復push、再検証、merge/DEVを別の証拠として記録する。未着手のまま「自動修復完了」と報告しない。
- GitHubの既存PR/Issueへ成果を残す。追加のGmail/Slack/ntfy直接送信やChatGPT通知を作らない。

## browser / DEVとの並列性

Browser smokeはFast Laneと並行して走り、失敗は `browser-repair:v1` Issueへ送る。Browser Work repairはIssue単位でclaimし、最大attempt内で同じPR/repair branchを修復する。browserが赤でも独立Ready PRのmerge laneは停止しない。

DEV publicationは各Fast Lane pass後に最新develop SHAへ明示dispatchされ、古いautomatic publisherをcancel/coalesceする。公開中にさらにPRがmergeされた場合は新しいdevelop SHAのpublisherが優先され、古いDEV publish完了を待ってから次PRをmergeする構成にはしない。

## 受入条件

1. 真のconflictを検出したFast Lane passが、同じexact headへ一度だけDeep Repair Issue/statusを作る。
2. 同じheadを再評価してもIssueを重複生成しない。
3. headが変わった場合は新しいexact headとして再評価する。
4. Fast Repair可能なbehind/stack更新はDeep Repairへ送らない。
5. large-baseはcomplete comparisonでFast Laneに残し、サイズだけでDeep Repairへ送らない。
6. Deep Repair要求中でも他のeligible PRはmergeされる。
7. Browser/DEV repair/publication中でも新しい独立Ready PRはFast Laneへ入れる。
8. main / Production gate、review/hold/thread/dependency gate、exact-head validationを弱めない。
9. 追加OpenAI API/PAT/有料fallbackをRepositoryの通常制御面へ追加しない。

## Ready CI failureの修復契約

Ready PRのcurrent exact-head `Validate and build` がfailure/timed_outで完了した場合も、失敗run/jobを特定して既存Deep Repair Issueへ送る。CIはbuild成功・失敗の両方でIntegrationをwakeし、開始時点の観測だけで停止させない。自身のwake jobが実行中でもbuild jobの完了を根拠にできる。

最新validation runのjobだけを調べ、成功したobservation/Draft run、旧head、実行中・skipped・cancelledの検証、旧rerun attemptは失敗の根拠にしない。`repairKind=ci-failure` と `ciFailure` にhead/runId/runAttempt/jobId/jobName/conclusion/runUrl/jobUrlを記録する。Workはその失敗jobのstepsと必要なlog範囲から調査する。

handoff直前にcurrent PR/head/developとhold/review/thread/dependencyを再取得する。同じheadのclosed・上限到達・human-required Issueも再生成せず、claim/attempt制限を維持する。修復中も独立PRのIntegrationは継続する。

## Issue件数に依存しないhandoff

同じexact headの修復Issue確認にRepository全体のopen/closed PR・Issue一覧走査を使わない。exact-head検索、既存statusのIssue参照、検索index反映待ちを補う直近open 100件から候補を取得し、Issue本体を再取得してsourceKey・state・attemptを確認する。closed/上限到達/human-requiredは維持する。検索結果が不完全なら修復Issueを新規作成せず、不完全な検索を「既存なし」と扱わない。

同じheadの重複Issueが既に存在する場合は、human-requiredや試行上限などの停止判断を優先する。停止判断がなければ既存working claim、open pendingの順に再利用し、閉じた未着手の重複Issueで進行中のclaimを隠さない。closed Issueしか残っていない場合も新規生成や再openは行わない。
