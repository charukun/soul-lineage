# Astra: autonomous iteration 実行プロンプト

対象 `{game}` は `village` / `kuumetsu` / `rinne`。回数は明示値、未指定なら1。各iterationをmergeまで直列完了し、次回は新しいdevelopから開始します。

> このprompt自体も現在世代の外骨格です。ここに書かれた工程を永久的な開発真理としてruntimeやgameplayへ埋め込まないでください。現行契約では全工程を守りますが、frameworkを進化させる依頼では `.autonomous/EXOSKELETON.md` と `.autonomous/exoskeleton.json` を参照し、モデル/ツール能力が代替できるscaffoldは削除可能なものとして扱います。test / CI / browser review / evidence / receiptを含め、慣習だけを理由に残す機構はありません。

## 0. Run identity / telemetry

- 1リクエストにつきstable `runKey` を1つ作る。複数iterationsでも全回で同じrunKeyを使い、`iteration=1..N` だけを進める。並行セッションは別runKeyにする。
- 各iteration開始時、コードを読む前かつimmutable Before観測前に `createIterationTelemetry` / `telemetry-init` 相当でtelemetryを開始する。時刻はruntime/toolの実時刻を使い、推測しない。
- 正規stepは `observation → investigation → implementation → causalValidation → afterObservation → verdict → astraValidation → freshness → merge → devPublish`。
- step境界ごとに前stepの完了時刻・durationMsを確定し、同時刻から次stepを開始する。対象外stepも省略せず `skipped` として時間を確定する。
- Draft PR作成前はtelemetryをセッション内で保持する。Draft PR作成時にPR番号をbindし、PR bodyへ `autonomous-iteration-telemetry:v1` markerをupsertする。以後のstep境界でも同markerを更新し、人間向けPR本文は保持する。
- theme選定後に `theme/themeKey/rootCauses`、実装後に `improvementSummary/changes/changedPaths`、正式検証後に `validatedHead`、verdict確定時に `verdict`、merge後に `mergeSha` をpatchする。
- telemetryはPULSE表示用でありexperiment/receipt/Actions/freshnessの正本を置き換えない。PULSE表示のためにgateや工程を増やさない。

## 1. Observe before code

1. 最新develop SHA、AGENTS、対象charter/protected rules、recent history/receiptsを取得する。
2. gameplay iterationは、そのdevelop SHAに束縛されたimmutable staging snapshotを観測する。mutable latest DEVをBefore evidenceに使わない。
3. staging上の現象、再現条件、未確認範囲を記録し、改善候補を3〜5個出す。ユーザーフィードバックは候補より優先する。
4. modeを決める。既定は `village=hardening`、`kuumetsu=evolution`、`rinne=hardening`。明示依頼があれば上書きする。
5. modeに照らして1 player-experience themeを選ぶ。「最小の不具合」ではなく、プレイヤーが達成できていない判断・理解・成長・操作・反応をplayerProblemとして束ねる。自己採点や「実装が簡単だから」は選定根拠にしない。
6. playerProblemに対するtargetStateと、プレイヤー側から確認できるsuccessSignalsを最低2件定義する。

## 2. Investigate and hypothesize

7. 選んだthemeに属するroot causeを1件以上列挙し、それぞれ必要なsource、caller、状態のread-side、同一theme/root-cause履歴だけを絞って読む。全repo探索を先にしない。
8. root causeを踏まえ、同じtargetStateへ因果的に寄与するwork itemを原則2〜6件に束ねる。各work itemへrootCauseKeys / paths / causal evidenceを割り当てる。単発work itemにする場合は、critical-regression / protected-rule-risk / observation-found-one-causal-fix のいずれかとObservation EvidenceをsingleFixExceptionへ記録する。
9. theme全体の仮説に加え、各root causeへexact revision/path/symbolのEvidence、prediction、falsifier、対象pathsを定義する。themeの解決案は最低2案比較する。
10. v3 experiment原本を作る。原本には最終verdict/learning/merge SHAを書かない。Evidence planには全work itemのcoverageを列挙する。Evolution/Polishはstaging Afterをrequiredにする。
11. 専用branch/Draft PRを最新developから作り、PR番号をtelemetryへbindしてPR body markerを初回upsertする。その後Connectorのblob→tree→commit→refで実装する。失敗時も同branch/PRを修復する。

## 3. Prove with the smallest useful evidence

12. 各work itemには最小のpure/leaf/native regression assertionまたは同等のcausal evidenceを割り当てる。複数work itemを1つの既存caseでまとめて証明できるならcase数は増やさない。work item数を理由に広いsimulation/browser/buildを自動追加しない。
13. portable probeが対象を測らない場合、差がないことを失敗扱いせず、coverage外と明記する。probeをゲーム全体の改善評価器にしない。
14. Evolution/Polish、またはplayer-facing Hardeningは、実装後に同条件・固定SHA staging Afterを観測する。Beforeとartifact/source/条件のidentityを記録する。
15. `tests/develop-completion-contract.test.mjs` のactive IDは編集しない。validation base→head差分から新規experimentを自動検出する。

## 4. Adopt candidate, validate once, and merge

16. 必要なstaging Afterを観測した時点で、全work itemのcausal/native evidence、successSignals、theme仮説/falsifierを照合し、candidateを採用できるか判定する。Player-facing欠陥があれば同branchでbounded repairし、新candidate exact SHAを再stagingして観測する。未確認事項はnotVerifiedへ残し、一部成功を全体supportedへ丸めない。
17. 採用candidateが確定してから最新developを再取得する。SHA進行だけではreconcileしない。衝突/impact overlapがある場合だけ同branchへ意味を保ってreconcileする。reconcileがplayer-facing/build inputを変えた場合だけcandidateを再stagingして再確認する。
18. 原本にPR番号をbindし、採用済みの最終commitに `[astra-validate]` と最小の `Astra-Check/Test/Build` を明示する。staging観測前のdraftをmerge-owning validationへarmしない。
19. この最終headのmerge-owning exact-head validationだけを待つ。失敗は同branchで自己修復する。修復がplayer-facing結果を変えるならstaging Afterへ戻して再確認してから、新しい最終headを1回だけarmする。gateを弱めない。
20. validation/freshness成功後すぐReady→検証済みexpected headをdevelopへmergeする。Readyで止まらない。DEV publication完了は待たない。
21. 同PRへ `autonomous-receipt:<game>:<id>` marker付き確定receiptを残す。validated head/base/run、native evidence、staging Before/After、verdict、learning、merge SHA、notVerifiedを含める。同時にtelemetryのverdict/mergeShaを確定し、`devPublish` を開始状態へ進める。DEV完了待ちはしない。
22. 次iteration開始時に直前receiptを解決し、必要なら `.autonomous/<game>/receipts/<id>.json` へmaterializeする。過去experimentは編集しない。

複数iterationsで前回themeを惰性継続しない。各回、更新されたstagingを観測して候補から選び直す。通常gameplay iterationは複数work itemを標準とし、修正数ではなくplayerProblem→targetStateの閉じ方でscopeを決める。無関係な問題を混ぜて密度を水増ししない。


## Controller lane for one-request completion

For multi-iteration requests, create one stable `run_key` at the beginning and keep it for the full request. Each iteration is serial:

```
exact current develop
  -> dispatch existing Per-App DEV Publish with exact source_sha
  -> capture immutable Cloudflare version preview as Before
  -> choose theme / create experiment / dedicated branch + Draft PR
  -> implement + smallest causal/native preflight
  -> publish the exact candidate
  -> capture immutable version preview as After
  -> bounded repair / re-stage if needed
  -> verdict / adopt candidate
  -> latest-develop impact check / reconcile only if required
  -> one exact-head Astra merge validation
  -> freshness / Ready / develop merge
  -> next iteration from the new merge SHA
```

Never use the mutable latest DEV URL as Before/After. The normal DEV worker is only the publication vehicle; the immutable Cloudflare version preview is the observation surface. Once a version preview is captured and its `version.json.commit` matches the pinned SHA, unrelated sessions cannot alter that evidence. Required After observation is authoring feedback that selects the candidate source; formal merge-owning Astra validation comes after candidate adoption, not before it.

If the shared publication job is cancelled before version capture, retry the same exact SHA instead of rebasing or changing the run. Develop drift remains irrelevant until the normal freshness check.

A refuted or inconclusive experiment still counts as a completed iteration when its evidence, receipt and develop merge are complete. Continue automatically until the requested iteration count is exhausted.
