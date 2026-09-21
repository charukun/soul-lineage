# Autonomous Game Improvement

対象は `village` → `apps/village`（星継ぎの庭）、`kuumetsu` → `apps/demon`（喰滅廻遊）。正本は現在の `develop`、`AGENTS.md`、GitHub状態です。

## iteration の基本形

1 iteration = 1 improvement theme。1 theme の中で複数root cause・複数修正を扱えます。たとえば「撤退判断を成立させる」というthemeの中で、警戒度・負傷・持ち帰り量・帰還報酬・UI接続をまとめて直して構いません。禁止するのは無関係なついで修正であり、修正数そのものではありません。

```
immutable staging observation
  -> candidate problems
  -> choose one improvement theme
  -> identify related root causes
  -> focused source investigation
  -> falsifiable hypothesis
  -> implementation
  -> smallest causal/native validation
  -> same-condition staging After when required
  -> receipt / learning
  -> freshness / Ready / develop merge
```

コードを先に広く読んで「見つけやすい小バグ」をiterationに昇格させません。まずゲーム上の観測からtheme候補を作り、採用themeに属するroot causeだけsource/caller/read-sideを追います。1 theme内のroot causeは複数可ですが、各root causeは観測・変更・Evidenceへ追跡可能でなければなりません。

## iteration mode

新規experimentは `mode` を持ちます。

- `hardening`: 完成度の高いゲームを壊さず、整合性、境界、保存、操作、性能、到達性を強化する。
- `evolution`: 発展途中のゲームで、意思決定、system接続、risk/reward、世界反応、成長ループなどゲームシステム自体を進化させる。
- `polish`: gameplay仕様を維持し、UI、camera、VFX、audio、feel、可読性を改善する。

既定は `village=hardening`、`kuumetsu=evolution`。明示された依頼が優先します。

## immutable staging observation

Gameplay experiment v2 は実装前に exact source SHA に束縛された staging observation を持ちます。最低限、`sourceSha`、immutable artifact/URL/reference、観測時刻、再現条件、確認した現象、未確認範囲を保存します。

mutableな「最新DEV URL」はBefore/After Evidenceに使いません。Evolution/Polishは固定SHA stagingがなければ開始しません。stagingは問題発見とplayer-facing Before/Afterの観測面であり、passing browser observationだけで因果修正を証明しません。pure/leaf/native testや既存native pathがcausal evidenceを担当します。

現在の `village` / `kuumetsu` staging observation surface はCloudflare Worker version previewです。通常のlatest DEV URLを観測URLとして保存せず、該当deployの `Current Version ID` から `scripts/staging-preview.mjs` でimmutable preview URLを作り、公開先の `version.json.commit` がrecordの `sourceSha` と一致することを確認します。これは同じ `web-dev` artifactの固定versionなので、`version.json.environment` は `dev` のままです。

## experiment v2 と receipt

既存schemaVersion 1 experimentは履歴互換のため不変で読み続けます。新規iterationはschemaVersion 2を使います。

v2 experimentは実装前に確定できるものだけを保存します: mode、Observation + immutable staging baseline、`themeKey`、`rootCauses[]`、theme hypothesis/falsifier、candidate比較、implementation scope、evidence plan、PR receipt marker。`rootCauses[]` は最低1件で、各項目に `key / summary / prediction / falsifier / paths` を持たせます。

最終verdict、Before/After結果、validation head/run、merge SHA、learningはexperiment自身へ書かずreceiptに保存します。merge直後の確定receiptは同PR Conversationへmarker付きで残し、次iterationで `receipts/<id>.json` へmaterializeできます。過去experimentは上書きしません。

`experiment-history.json` は直近12件の発見索引です。v2の完了状態を `verdict: pending` から推測せず、persisted receipt、PR marker、live GitHub merged/run/headを照合して状態を導出します。

## active experiment の自動検出

共有 `tests/develop-completion-contract.test.mjs` のIDを書き換えません。merge-owning validationでは、validation baseとexact headのgit diffから今回追加された `.autonomous/<game>/experiments/<id>.json` を自動検出します。

これによりvillage/kuumetsuの並行sessionが共有active定数を奪い合いません。1 iterationは原則1 experimentです。同一themeを分割記録する必要がある場合のみ最大2件まで許可し、validationは同一`themeKey`を要求します。過去experimentの編集・削除は禁止です。

## Evidence と probe

portable probeは限定されたcausal probeで、ゲーム全体の品質評価器ではありません。village probeは `demography.js`、kuumetsu probeは `balance.js` のportable stateだけを測ります。

対象問題がprobe coverage外なら、probe差分を無理に改善証明へ使いません。関連する最小native testへ因果assertionを置き、coverage/notVerifiedを正確に記録します。Evolution/Polishではstaging Afterも原則必須です。

広いsimulation、全戦闘win-rate、browser sweep、全app buildを通常iterationへ常設しません。必要な場合だけAstraが最小の検証を選択します。

## Fast DEV と merge

Actions workflowは既存の `.github/workflows/astra-work-validation.yml` を使い、この仕組みから変更しません。最終coherent headのcommitだけを `[astra-validate]` と明示的な `Astra-Check/Test/Build` でarmします。

正式な成功は `MERGED_TO_DEVELOP`。exact-head focused validation、freshness、Ready、同session develop mergeまで完遂します。DEV publication完了は待ちません。main / Productionは明示許可なしに変更しません。

## 履歴と学習

同一themeKeyおよび各root cause keyについて過去experimentとreceiptを調べます。v1/旧v2の`problemKey`も互換検索します。v1はexperiment内learning、v2はreceipt learningを正本にします。既知の `doNotRetry` を再選択する場合、新しいEvidenceとretryJustificationが必要です。

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


## Isolated autonomous staging controller

Repeated autonomous runs use the existing `.github/workflows/dev-app-publish.yml` workflow with an exact `source_sha`, then bind observation to the Cloudflare Worker **version preview** returned by that publication.

The controller contract is:

1. Pin the current iteration to one exact source SHA and a stable `run_key`.
2. Dispatch `Per-App DEV Publish` manually with `app` plus that exact `source_sha`. Do not observe the mutable latest DEV URL.
3. Read the publication's `Current Version ID`, derive the immutable preview with `scripts/staging-preview.mjs`, and verify `version.json.commit === source_sha`.
4. Once captured, that version preview is the iteration's staging coordinate. Later develop pushes or unrelated DEV publishes cannot overwrite it.
5. If the shared publish job is cancelled before the immutable version is captured, retry the same exact SHA. Cancellation never changes the run's source coordinate.
6. Code changes stay on the iteration's dedicated branch / Draft PR. Other develop movement is considered only by the normal merge freshness gate.
7. After a validated merge, the next iteration begins from the new merge SHA and captures a new immutable Before preview.

`scripts/autonomous-run-controller.mjs` plans these coordinates and binds Cloudflare version IDs. It rejects mutable source coordinates and carries one `run_key` across all requested iterations.

This controller adds no persistent Actions workload and does not alter Fast DEV, exact-head Astra validation, freshness, Ready, develop merge, or Production gates.
