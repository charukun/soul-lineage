# Code-First Autonomous Improvement

対象は `village` → `apps/village`（星継ぎの庭）、`kuumetsu` → `apps/demon`（喰滅廻遊）。現在の `develop`、`AGENTS.md`、GitHub の状態が正本です。短い「村アプリを1 iteration自律改善してください」「喰滅廻遊を3 iterations自律改善してください」は [実行プロンプト](prompts/run-iteration.md) へルーティングします。

## 開始と完了

1 iteration = 原則1 root cause。対象の charter / protected-rules / observations / hypotheses / experiment-history を読む → 該当コードと過去の同一問題を調べる → Evidence と反証可能な仮説・候補比較 → 小さな実装 → 同条件の Before/After → 仮説判定・学習 → 最終 exact-head を hosted runner で検証 → freshness → Ready → **同じセッションで develop merge**。

成功はコード追加でも Ready でもなく `MERGED_TO_DEVELOP`。仮説が棄却されても、失敗記録と必要な安全な修正を残す。ゲーム変更を無理に成功扱いして merge しない。通常 iteration はブラウザ・公開URL・画像・動画・人間確認・DEV配信完了を要求しない。既存の必須gateが対象変更に要求する検証は省略しない。

## 再利用する経路と費用上限

`.github/workflows/astra-work-validation.yml` を変更せず使います。専用 branch の最終 commit に `[astra-validate]` を付け、`astra/fast-dev-contract` と `astra/focused-validation` の両 success を確認します。workflow の追加、case数増加、Fast DEV lifecycle変更、検証用ネットワーク・素材取得は追加しません。

`tests/develop-completion-contract.test.mjs` の既存1 caseに `activeExperiments` を持たせています。各 iteration はこの対象IDを当該 experiment に更新し、既存の完了条件assertionを残して、履歴・Evidence・本番保護・同一head条件を検証します。これにより既存の「変更された .test.mjs」選択で Code-First 検証が実行されます。別のtest caseの追加や、テスト名偽装・削除による上限回避は禁止です。ゲームの変更には関連する既存caseの回帰assertionも追加し、古いassertionを保持します。

正式な検証は GitHub hosted runner の実checkoutで実行。Chat内構文チェックはpreflightです。CLIの `probe` は参照版の依存なしleafソースを `git show` で読み、同じ最終harnessを両側に使います。Chatローカルgitは不要で、実行場所は既存Actionsです。`gate` のREST読み出しは任意のcheckoutでの補助であり、ChatではConnectorで得た生JSONを同じ判定へ渡せます。どちらも公開ゲームURLにはアクセスしません。

## コマンド（Node 24、repository root）

```sh
node .autonomous/cli.mjs context village
node .autonomous/cli.mjs lookup village durable-code-first-loop
node .autonomous/cli.mjs check --base origin/develop --head HEAD
node .autonomous/cli.mjs probe village --ref origin/develop --out /tmp/before.json
node .autonomous/cli.mjs probe village --ref HEAD --out /tmp/after.json
node .autonomous/cli.mjs compare /tmp/before.json /tmp/after.json
node .autonomous/cli.mjs record /tmp/experiment.json
node .autonomous/cli.mjs gate --pr 123 --head <40桁SHA> --base <40桁developSHA>
```

`kuumetsu` も同じ操作です。出力には source SHA / source digest / harness digest / seed条件 / 実行環境 / coverage / 未検証範囲を含めます。現在のseedは合成入力を変える識別子であり、ゲーム全体の乱数seedではありません。変更差は改善点数ではありません。比較条件、harness、scenario、metricが違えば比較を拒否します。全戦闘の勝率・時間・damage分布や村全体の到達可能性を検証済みとはしません。

既存の広い検証の入口は村 `apps/village/tests/progression.mjs`、喰滅廻遊 `apps/demon/tests/hunt-loop-native.test.mjs` と `hunt-loop.test.mjs`、共通戦闘 `packages/tidebreak-combat`。広いsimulationを必要もなく通常Actionsへ追加しません。新たな依存がleafへ加われば明示的にadapterを設計し直し、偽のゲームロジックやスタブで成功させません。

## 永続化と最終SHAの自己参照回避

`experiment-history.json` は直近12件、`archive/index.json` は古い記録のコンパクトな索引、`experiments/<id>.json` は追記のみの原本です。archiveへ移しても原本と失敗・棄却・再試行禁止条件を削除しません。同一problemKeyは `lookup` で検索します（8件ずつ、`--offset`）。既知の棄却案を再選択するときは、以前のIDと新しい外部/コードEvidenceを `retryJustification` へ記録しなければ拒否します。

**そのcommit自身の最終SHA・merge結果は、そのcommit内に書けません。** 原本には実験内容と暫定判定、および `validation.receipt` のPR番号と一意markerを保存します。最終runnerのJSONログを採取し、成功後、同PRのConversationへ [receipt形式](templates/receipt.json) の確定結果を追記します。markerは `autonomous-receipt:<game>:<id>`。検証head、取り込んだdevelop、run、Before/After、最終仮説判定、学習、merge SHAを含めます。生ログの保存期限が来てもPR receiptから復元できます。次iterationで前回receiptを `receipts/<id>.json` へ追加保存しても構いませんが、過去experimentを上書きしません。

索引にpendingが残っているだけで未完了/完了を決めず、そのPRのmarker・現在のmerged状態・run/headを照合してください。receiptがない場合は未確認として復旧します。セッション停止時も同じbranch/PRを使い、replacement PRを作りません。構造検証は意味の正しさ・署名を保証しません。Evidenceの原文・参照版とGitHubの生状態は必ず照合します。

`record` は単一writer用です。複数ファイルのローカル書込み途中に停止した場合、孤立原本を消さず索引を修復します。Connectorではblob→tree→commit→refを一括の最終treeにして原本と索引を原子的に公開します。1 branchを並列writerで更新しません。

## 外部フィードバック

ユーザーの言葉は受領日時・元の発言/issue/PR参照とともに observationsへ保存し、通常のコード推論より優先します。発言原文を改変せず、推論と実測とユーザーの体感を別欄にします。「変更しないで」は対応するprotected ruleへ出典付きで追記します。矛盾する旧仮説は棄却/保留を記録します。AIから確認を要求せず、確認待ちにもなりません。

## DEV

`develop` pushで既存の `Per-App DEV Publish` が影響appを選択して非同期公開します。公開完了・URL確認・通常非同期CIはiterationの待機点ではありません。古いREADMEにあるReady終了/公開URL必須の記述より、現在の `AGENTS.md` / `docs/DEVELOPMENT.md` / `docs/DEVELOP_MERGE.md` とworkflowを優先します。
