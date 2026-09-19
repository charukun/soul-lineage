# Autonomous Game Improvement

対象は `village` → `apps/village`（星継ぎの庭）、`kuumetsu` → `apps/demon`（喰滅廻遊）。正本は現在の `develop`、`AGENTS.md`、GitHub状態です。

## iteration の基本形

1 iteration = 1 root cause。root cause は1関数のバグに限定せず、選択が結果へ接続されない、世界がプレイヤーへ反応しない、失敗が保存へ誤反映される等のゲーム上の構造問題を含みます。

```
immutable staging observation
  -> candidate problems
  -> choose one root cause
  -> focused source investigation
  -> falsifiable hypothesis
  -> implementation
  -> smallest causal/native validation
  -> same-condition staging After when required
  -> receipt / learning
  -> freshness / Ready / develop merge
```

コードを先に広く読んで「見つけやすい小バグ」をiterationに昇格させません。まずゲーム上の観測から候補を作り、選んだ問題だけsource/caller/read-sideを追います。

## iteration mode

新規experimentは `mode` を持ちます。

- `hardening`: 完成度の高いゲームを壊さず、整合性、境界、保存、操作、性能、到達性を強化する。
- `evolution`: 発展途中のゲームで、意思決定、system接続、risk/reward、世界反応、成長ループなどゲームシステム自体を進化させる。
- `polish`: gameplay仕様を維持し、UI、camera、VFX、audio、feel、可読性を改善する。

既定は `village=hardening`、`kuumetsu=evolution`。明示された依頼が優先します。

## immutable staging observation

Gameplay experiment v2 は実装前に exact source SHA に束縛された staging observation を持ちます。最低限、`sourceSha`、immutable artifact/URL/reference、観測時刻、再現条件、確認した現象、未確認範囲を保存します。

mutableな「最新DEV URL」はBefore/After Evidenceに使いません。Evolution/Polishは固定SHA stagingがなければ開始しません。stagingは問題発見とplayer-facing Before/Afterの観測面であり、passing browser observationだけで因果修正を証明しません。pure/leaf/native testや既存native pathがcausal evidenceを担当します。

## experiment v2 と receipt

既存schemaVersion 1 experimentは履歴互換のため不変で読み続けます。新規iterationはschemaVersion 2を使います。

v2 experimentは実装前に確定できるものだけを保存します: mode、Observation + immutable staging baseline、root cause/hypothesis/falsifier、candidate比較、implementation scope、evidence plan、PR receipt marker。

最終verdict、Before/After結果、validation head/run、merge SHA、learningはexperiment自身へ書かずreceiptに保存します。merge直後の確定receiptは同PR Conversationへmarker付きで残し、次iterationで `receipts/<id>.json` へmaterializeできます。過去experimentは上書きしません。

`experiment-history.json` は直近12件の発見索引です。v2の完了状態を `verdict: pending` から推測せず、persisted receipt、PR marker、live GitHub merged/run/headを照合して状態を導出します。

## active experiment の自動検出

共有 `tests/develop-completion-contract.test.mjs` のIDを書き換えません。merge-owning validationでは、validation baseとexact headのgit diffから今回追加された `.autonomous/<game>/experiments/<id>.json` を自動検出します。

これによりvillage/kuumetsuの並行sessionが共有active定数を奪い合いません。1 iterationは原則1 experiment、同一root causeを表す関連recordが必要な場合のみ最大2件です。過去experimentの編集・削除は禁止です。

## Evidence と probe

portable probeは限定されたcausal probeで、ゲーム全体の品質評価器ではありません。village probeは `demography.js`、kuumetsu probeは `balance.js` のportable stateだけを測ります。

対象問題がprobe coverage外なら、probe差分を無理に改善証明へ使いません。関連する最小native testへ因果assertionを置き、coverage/notVerifiedを正確に記録します。Evolution/Polishではstaging Afterも原則必須です。

広いsimulation、全戦闘win-rate、browser sweep、全app buildを通常iterationへ常設しません。必要な場合だけAstraが最小の検証を選択します。

## Fast DEV と merge

Actions workflowは既存の `.github/workflows/astra-work-validation.yml` を使い、この仕組みから変更しません。最終coherent headのcommitだけを `[astra-validate]` と明示的な `Astra-Check/Test/Build` でarmします。

正式な成功は `MERGED_TO_DEVELOP`。exact-head focused validation、freshness、Ready、同session develop mergeまで完遂します。DEV publication完了は待ちません。main / Productionは明示許可なしに変更しません。

## 履歴と学習

同一problemKeyは過去experimentとreceiptを調べます。v1はexperiment内learning、v2はreceipt learningを正本にします。既知の `doNotRetry` を再選択する場合、新しいEvidenceとretryJustificationが必要です。

## CLI

```sh
node .autonomous/cli.mjs context village
node .autonomous/cli.mjs lookup village <problemKey>
node .autonomous/cli.mjs active --base origin/develop --head HEAD
node .autonomous/cli.mjs check --base origin/develop --head HEAD
node .autonomous/cli.mjs probe village --ref HEAD
node .autonomous/cli.mjs compare before.json after.json
node .autonomous/cli.mjs record experiment.json
node .autonomous/cli.mjs receipt receipt.json
```

Connector実装ではexperiment/indexやreceiptをblob→tree→commit→refのcoherent treeとして公開します。1 branchを並列writerで更新しません。
