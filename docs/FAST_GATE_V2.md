# Fast Gate v2

## Goal

Develop向けReady PRの `Validate and build` を、品質gateを弱めずに変更責務へ比例する検証へする。軽いapp変更で、変更していないshared packageの全単体テストやHeavy QAを毎回再実行しない。

## Principles

- exact-head `Validate and build` と `pr-fast-<PR>-<SHA>` artifactは維持する。
- Production / main のfull gate、browser assertions、review / hold / dependency / mergeability gateは変更しない。
- App-only変更は、変更app自身のcheck/test/buildを中心に検証する。変更していないdependency packageの単体テストは再実行しない。
- Shared package変更は、そのpackageのcheck/testと影響appのapp-level test/buildを実行する。
- motion / rig / 3D / networkなど高コスト領域は、該当pathを変更したときだけHeavy QAを追加する。現在の高コストRinne rig回帰はmotion/character/rendering系pathだけで実行する。
- tooling / workspace manifest / CI / Integration control変更はfail-closedで広い検証を維持する。
- `integration-gate-cost` のprofileをFast Gate scopeでも再利用し、diff/syntax preflightをdependency installより前、軽量testをHeavy QAより前に実行する。
- Git checkoutはexact PR headとexact validation baseを浅く取得し、全remote branch historyの取得を通常Fast Gateの前提にしない。Fast Gateのdiff/visual/code-health guardはexact base/headのtree比較を使う。

## Acceptance

1. app-only PRは、未変更shared packageの全test suiteを実行しない。
2. shared package変更では、変更packageと影響appの必要な契約を検証する。
3. Heavy QAは関連path変更時だけ起動する。
4. 安価なsyntax/app contract違反はHeavy QAより先にfailする。
5. exact-head artifact、Fast Lane再検証、browser非blocking、single develop writerを維持する。
6. main / Production quality gateを弱めない。
