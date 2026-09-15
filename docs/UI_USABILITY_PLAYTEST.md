# 3アプリ UI操作性 playtest

輪廻転焦 (`rinne`)、MURAAAAAAA (`village`)、尽喰廻遊 (`demon`) のスマートフォン操作性を、実ブラウザ入力の証拠に基づいて改善するための記録です。

## 今回の受入条件

- 3アプリすべてを mobile viewport の実Chromium入力で通し、`browser playtest` の run / artifact を残す。
- タイトル開始、主要な移動・ゲーム内操作、主要メニュー/補助UI、戻る/閉じる操作まで確認する。
- 画面を常時読む必要があるUI、誤タップしやすいUI、指で隠れやすいUI、移動だけで済む場面に残る不要操作、モーダル/ドロワーの閉じにくさを優先して扱う。
- 実プレイで得た所見から改善計画を作り、類似のopen PRとchanged filesを確認して重複を避ける。
- 修正後も `Browser-Playtest: all` で3アプリを再実行し、Fast Lane / browser self-healing / DEV publicationの既存gateを維持する。
- main / Productionは変更しない。

## 記録ルール

`static review`、`browser playtest`、`DEV browser verified` を混同しない。実プレイ所見と改善内容は、この文書を同じ作業PR内で更新して残す。
