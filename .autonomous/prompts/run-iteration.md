# Astra: autonomous iteration 実行プロンプト

対象 `{game}` は `village` または `kuumetsu`。回数は明示値、未指定なら1。各iterationをmergeまで直列完了し、次回は新しいdevelopから開始します。

## 1. Observe before code

1. 最新develop SHA、AGENTS、対象charter/protected rules、recent history/receiptsを取得する。
2. gameplay iterationは、そのdevelop SHAに束縛されたimmutable staging snapshotを観測する。mutable latest DEVをBefore evidenceに使わない。
3. staging上の現象、再現条件、未確認範囲を記録し、改善候補を3〜5個出す。ユーザーフィードバックは候補より優先する。
4. modeを決める。既定は `village=hardening`、`kuumetsu=evolution`。明示依頼があれば上書きする。
5. modeに照らして1 improvement themeを選ぶ。自己採点や「実装が簡単だから」は選定根拠にしない。theme内では複数root causeを扱ってよいが、無関係な問題を混ぜない。

## 2. Investigate and hypothesize

6. 選んだthemeに属するroot causeを1件以上列挙し、それぞれ必要なsource、caller、状態のread-side、同一theme/root-cause履歴だけを絞って読む。全repo探索を先にしない。
7. theme全体の仮説に加え、各root causeへexact revision/path/symbolのEvidence、prediction、falsifier、対象pathsを定義する。themeの解決案は最低2案比較する。
8. v2 experiment原本を作る。原本には最終verdict/learning/merge SHAを書かない。Evolution/Polishはstaging Afterをevidence planでrequiredにする。
9. 専用branch/Draft PRを最新developから作り、Connectorのblob→tree→commit→refで実装する。失敗時も同branch/PRを修復する。

## 3. Prove with the smallest useful evidence

10. 各root causeには最小のpure/leaf/native regression assertionまたは同等のcausal evidenceを割り当てる。既存caseに置けるならcase数を増やさない。複数root causeだからといって広いsimulation/browser/buildを自動追加せず、themeの因果証明に必要なものだけ使う。
11. portable probeが対象を測らない場合、差がないことを失敗扱いせず、coverage外と明記する。probeをゲーム全体の改善評価器にしない。
12. Evolution/Polish、またはplayer-facing Hardeningは、実装後に同条件・固定SHA staging Afterを観測する。Beforeとartifact/source/条件のidentityを記録する。
13. `tests/develop-completion-contract.test.mjs` のactive IDは編集しない。validation base→head差分から新規experimentを自動検出する。

## 4. Validate and merge

14. coherent treeになったら最新developを再取得する。SHA進行だけではreconcileしない。衝突/impact overlapがある場合だけ同branchへ意味を保ってreconcileする。
15. 原本にPR番号をbindし、最終commitに `[astra-validate]` と最小の `Astra-Check/Test/Build` を明示する。
16. merge-owning exact-head validationだけを待つ。失敗は同branchで自己修復する。gateを弱めない。
17. 各root causeのcausal/native evidenceと必要なstaging Afterを確認し、theme全体の仮説/falsifierへ照合してsupported/refuted/inconclusiveを決める。部分改善はreceiptに明記し、未解決root causeを隠さない。
18. freshness成功後すぐReady→検証済みexpected headをdevelopへmergeする。Readyで止まらない。DEV publication完了は待たない。
19. 同PRへ `autonomous-receipt:<game>:<id>` marker付き確定receiptを残す。validated head/base/run、native evidence、staging Before/After、verdict、learning、merge SHA、notVerifiedを含める。
20. 次iteration開始時に直前receiptを解決し、必要なら `.autonomous/<game>/receipts/<id>.json` へmaterializeする。過去experimentは編集しない。

複数iterationsで前回themeを惰性継続しない。各回、更新されたstagingを観測して候補から選び直す。1 iterationで扱う修正数に固定上限は置かないが、すべて同じthemeへ因果的に属していること。


## Controller lane for one-request completion

For multi-iteration requests, create one stable `run_key` at the beginning and keep it for the full request. Each iteration is serial:

```
exact current develop
  -> dispatch existing Per-App DEV Publish with exact source_sha
  -> capture immutable Cloudflare version preview as Before
  -> choose theme / create experiment / dedicated branch + Draft PR
  -> implement + exact-head Astra validation
  -> publish the exact candidate or merge-equivalent source
  -> capture a new immutable version preview as After
  -> verdict / receipt / freshness / Ready / develop merge
  -> next iteration from the new merge SHA
```

Never use the mutable latest DEV URL as Before/After. The normal DEV worker is only the publication vehicle; the immutable Cloudflare version preview is the observation surface. Once a version preview is captured and its `version.json.commit` matches the pinned SHA, unrelated sessions cannot alter that evidence.

If the shared publication job is cancelled before version capture, retry the same exact SHA instead of rebasing or changing the run. Develop drift remains irrelevant until the normal freshness check.

A refuted or inconclusive experiment still counts as a completed iteration when its evidence, receipt and develop merge are complete. Continue automatically until the requested iteration count is exhausted.
