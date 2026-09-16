# 3アプリ UI操作性 再playtest 2026-09-17

輪廻転焦 (`rinne`)、MURAAAAAAA (`village`)、尽喰廻遊 (`demon`) を、最新 `develop` を正本としてスマートフォン相当の実Chromium入力で再確認する。

## 受入条件

- `Browser-Playtest: all` で3アプリすべてを実ブラウザ入力し、run / artifact / `playtest-receipt.json` を残す。
- タイトル開始、主要移動、主要ゲーム内操作、主要メニュー、戻る/閉じる操作を確認する。
- 実プレイ証拠から、誤タップ、指で隠れる操作、常時読む必要があるUI、不要な操作、閉じにくいモーダル/ドロワー、低FPSで待ち時間が伸びる操作を優先して改善計画へ落とす。
- 類似open PRを確認し、重複実装を作らない。
- 必要なuser-facing修正後に `Browser-Playtest: all` を再実行する。
- develop統合後にDEV公開/source確認まで行い、main / Productionは変更しない。

## 現在の正本

- task start develop: `2bd278345f0158f88118419bc10394d43eb5a0fa`
- 旧PR #488 は同じ目的の未完了作業で、現在のdevelopから大きく乖離しているため今回の正本にはしない。旧artifactは原因分析の参考に限る。
- 今回の改善判断は、fresh exact-head browser artifactと現在のコード契約を根拠にする。

## 記録ルール

`static review`、`browser playtest`、`DEV browser verified` を区別する。3アプリを実際に完走していない状態で「3アプリをプレイ済み」と記録しない。
