# Code Health / 自律リファクタ

AI実装を高速・並列に積み重ねても、単一ファイルの肥大化、巨大関数、分岐密度、app間のコピー実装が静かに増え続けないようにするためのRepository-nativeな保守経路です。実装の正本、Draft → Ready → Integration、RINNE Dispatchを置き換えず、その前後に「増やしにくくするguard」と「定期的に減らすmaintenance」を追加します。

## 2つの経路

### 1. Regression guard

`node scripts/validate.mjs fast <base> <head>` は既存のworkspace check/test/buildに加え、`scripts/code-health.mjs guard <base> <head>` を実行します。

既存の大きなファイルを触っただけで失敗させません。baseとheadを比較し、次のような**新しい実質的な悪化**だけを止めます。

- 既に600 LOCを超えるsourceへ一度に120 LOC以上を追加する
- 長い関数をさらに約40行以上成長させる
- 大きいsourceで分岐数と分岐密度を同時に大きく増やす
- 新規sourceを900 LOC以上、または約180行以上の巨大関数として追加する
- 1800 LOC / 約300行関数のhard boundaryを新たに跨ぐ

このguardは「変更を禁止する」ものではありません。同じ責務を別moduleへ分ける、既存packageへ寄せる、重複を共通化する方向へ実装を促します。現在ある負債を理由に通常PRを全面停止しないratchetです。

### 2. Scheduled maintenance

`.github/workflows/code-health.yml` は週2回、最新`develop`を軽量監査します。`npm ci`やブラウザは起動せず、tracked sourceだけをNodeで解析します。手動`workflow_dispatch`も利用でき、`dispatch=false`なら監査だけを行います。

監査用の一時ファイルはrunner起動後のstepで `RUNNER_TEMP` から初期化します。job-level `env` では `runner` contextを参照できないため、workflow定義時に評価させません。監査・backpressure・既存refactorの重複防止はそのまま維持します。

監査は以下を合成して0〜100のhotspot scoreを作ります。

- source LOC
- 推定した最長function block
- decisions / 100 LOC
- 8 meaningful lines以上の実質的なcross-file duplicate block

閾値は `scripts/code-health.config.json` にあります。これはヒューリスティックであり、意味的な正しさの証明ではありません。scoreだけを理由に公開APIやゲーム仕様を変更してはいけません。

## 自動リファクタの流れ

監査でactionable hotspotがある場合、scheduled runは次の条件を満たすと**1件だけ**自動リファクタを起動します。

1. `dispatch/code-health-*` のopen PRが存在しない。
2. `DISPATCH_GITHUB_TOKEN` または既存 `RESCUE_GITHUB_TOKEN` が利用できる。
3. 最上位hotspotがconfigured thresholdを超えている。

Code Health自身は実装しません。最新developから `dispatch/code-health-*` branchと一時 `.task-start` marker、develop向けDraft PRを作り、PR本文へ通常の `RINNE-Dispatch: implementation` / `## Request` contractを入れます。PR作成イベントから既存 `RINNE Dispatch` が起動し、focused refactor → fast validation → push → Ready for reviewまでを担当します。その後は通常どおりIntegrationがCI、develop統合、DEV公開を担当します。

独自Task-ID、独自queue、別のIntegration worker、外部状態DBは作りません。branch / PR / commitが復旧点です。自動refactorが既にopenなら次の定期監査は新しいPRを増やしません。

## Refactor workerの安全境界

自動Requestは最上位hotspot 1つと、直接関係するduplicate locationだけを対象にします。

- 行数を別の巨大fileへ移すだけの変更は禁止
- public API、ゲーム挙動、save/network authority、render/input timingは維持
- test、browser assertion、Integration gateを削除・緩和しない
- consumer/exportを確認してから責務分離する
- 既存shared packageを優先して再利用する
- 安全な構造改善ができない、または既に解消済みならno-opにする
- main / Productionは変更しない

`tests`、fixture、vendor、generated/build成果物は自動hotspot対象から除外します。テストの量を減らしてsource scoreを改善したように見せることを防ぐためです。

## 閾値変更

`code-health.config.json` の値は現在のPRを通すだけの目的で緩めません。閾値やworkflowの変更はautomation/control変更としてexact-headでレビューし、理由と影響をPRに残します。誤検知がある場合も、最初にparser/対象範囲/metricの問題を修正し、広い除外や無条件skipで黙らせないでください。

## 手元での確認

```bash
npm run health
node scripts/code-health.mjs guard origin/develop HEAD
node --test tests/code-health.test.mjs
```

`npm run health` はrepository全体の監査結果を表示します。guardは差分ratchetです。どちらも既存のsemantic testや実ブラウザ検証の代わりではありません。
