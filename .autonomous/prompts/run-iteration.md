# Astra: autonomous iteration 実行プロンプト

対象 `{game}` は `village` または `kuumetsu`。回数は明示値、未指定なら1。各iterationをmergeまで直列完了し、次回は新しいdevelopから開始します。

## 1. Observe before code

1. 最新develop SHA、AGENTS、対象charter/protected rules、recent history/receiptsを取得する。
2. gameplay iterationは、そのdevelop SHAに束縛されたimmutable staging snapshotを観測する。mutable latest DEVをBefore evidenceに使わない。
3. staging上の現象、再現条件、未確認範囲を記録し、改善候補を3〜5個出す。ユーザーフィードバックは候補より優先する。
4. modeを決める。既定は `village=hardening`、`kuumetsu=evolution`。明示依頼があれば上書きする。
5. modeに照らして1 root causeを選ぶ。自己採点や「実装が簡単だから」は選定根拠にしない。

## 2. Investigate and hypothesize

6. 選んだroot causeだけsource、caller、状態のread-side、同一problemKey履歴を絞って読む。全repo探索を先にしない。
7. exact revision/path/symbolのEvidence、cause、prediction、falsifierを先に定義し、最低2案を比較する。
8. v2 experiment原本を作る。原本には最終verdict/learning/merge SHAを書かない。Evolution/Polishはstaging Afterをevidence planでrequiredにする。
9. 専用branch/Draft PRを最新developから作り、Connectorのblob→tree→commit→refで実装する。失敗時も同branch/PRを修復する。

## 3. Prove with the smallest useful evidence

10. ゲーム変更には最小のpure/leaf/native regression assertionを使う。既存caseに置けるならcase数を増やさない。広いsimulation/browser/buildは対象仮説に必要な場合だけ使う。
11. portable probeが対象を測らない場合、差がないことを失敗扱いせず、coverage外と明記する。probeをゲーム全体の改善評価器にしない。
12. Evolution/Polish、またはplayer-facing Hardeningは、実装後に同条件・固定SHA staging Afterを観測する。Beforeとartifact/source/条件のidentityを記録する。
13. `tests/develop-completion-contract.test.mjs` のactive IDは編集しない。validation base→head差分から新規experimentを自動検出する。

## 4. Validate and merge

14. coherent treeになったら最新developを再取得する。SHA進行だけではreconcileしない。衝突/impact overlapがある場合だけ同branchへ意味を保ってreconcileする。
15. 原本にPR番号をbindし、最終commitに `[astra-validate]` と最小の `Astra-Check/Test/Build` を明示する。
16. merge-owning exact-head validationだけを待つ。失敗は同branchで自己修復する。gateを弱めない。
17. causal/native evidenceと必要なstaging Afterを仮説/falsifierへ照合し、supported/refuted/inconclusiveを決める。
18. freshness成功後すぐReady→検証済みexpected headをdevelopへmergeする。Readyで止まらない。DEV publication完了は待たない。
19. 同PRへ `autonomous-receipt:<game>:<id>` marker付き確定receiptを残す。validated head/base/run、native evidence、staging Before/After、verdict、learning、merge SHA、notVerifiedを含める。
20. 次iteration開始時に直前receiptを解決し、必要なら `.autonomous/<game>/receipts/<id>.json` へmaterializeする。過去experimentは編集しない。

複数iterationsで前回テーマを惰性継続しない。各回、更新されたstagingを観測して候補から選び直す。
