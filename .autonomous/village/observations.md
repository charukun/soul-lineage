# 観測

## V-001: 人口ルールの独立した検証口

`src/game/demography.js::planDemographicYear` は引数だけから births/departures/headroom/pairs を返す。`advanceVirtualCohorts` も描画・storageを要求しない。`tests/demography.test.mjs` は人口/住居上限、食料不足、cohort加齢、履歴120件を既に検証している。従って全ゲームrefactorなしで同条件比較を開始できる（source Evidence。まだ基盤のhosted成功Evidenceではない）。

## V-002: 既存の長期経路

`tests/progression.mjs` にWorld/Simulationを3600回更新する統合simulationがある。安価なleaf比較の代わりに常時実行する必要はない。未調査systemを「存在しない」「ゲーム性が弱い」と断言しない。

## 外部feedback受付

受領日時 / 原文 / 発言元 / 対象版（分かる場合） / code上の調査先 / 既存仮説への影響を記録する。現在の基盤構築依頼は運用方針の外部Evidenceであり、ゲームを遊んだ結果ではない。

調査基準: develop `c5c83902ed34ecce1ca7d3f50ac93f568dcc6945`。開始時に最新へ更新。

## V-003: 基盤の初回hosted失敗と依存境界

[失敗原本](../validation-attempts/1035-01.json): run 35457865372 は9ケース・15/21条件の比較に成功したが、app testからroot harnessへの相対importが既存architecture gateに違反して全体失敗。比較はroot toolingで実行し、app testはapp内native moduleのみ参照する。gateの例外化・動的importによる回避をしない。最終成功は同PRの別のexact-head receiptから確認する。
