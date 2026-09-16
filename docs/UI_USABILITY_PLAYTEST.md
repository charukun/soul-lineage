# 3アプリ UI操作性 playtest

輪廻転焦 (`rinne`)、MURAAAAAAA (`village`)、尽喰廻遊 (`demon`) のスマートフォン操作性を、実ブラウザ入力の証拠に基づいて改善するための記録です。

## 今回の受入条件

- 3アプリすべてを mobile viewport の実Chromium入力で通し、`browser playtest` の run / artifact を残す。
- タイトル開始、主要な移動・ゲーム内操作、主要メニュー/補助UI、戻る/閉じる操作まで確認する。
- 画面を常時読む必要があるUI、誤タップしやすいUI、指で隠れやすいUI、移動だけで済む場面に残る不要操作、モーダル/ドロワーの閉じにくさを優先して扱う。
- 実プレイで得た所見から改善計画を作り、類似のopen PRとchanged filesを確認して重複を避ける。
- 修正後も `Browser-Playtest: all` で3アプリを再実行し、Fast Lane / browser self-healing / DEV publicationの既存gateを維持する。
- main / Productionは変更しない。

## 実プレイ記録

- `190a2b65fb930f49384f2a431ecb84a7eac84810` の390×844 Chromiumでは、RINNEの誕生、スワイプ移動、4歳自立、武具装備までは実操作で通過した。
- 港での自動出航は、実装上 `requestAnimationFrame` の上限50msに丸めた simulation `dt` を1.5秒分積算していた。低FPS時は実時間1.5秒より大幅に長くなり、実ブラウザでは5秒待っても出航しないことを確認した。
- これはbrowser assertionだけの問題ではなく、低FPS端末で「港へ着いたのに反応しない」と感じる操作性問題として扱う。ゲーム本体の出航待ちだけを実時間基準へ変更し、寿命・戦闘・移動simulationの安全な `dt` 上限は維持する。
- 類似open PRを `harbor departure port dwell low fps` で確認し、該当なし。既存 #464 の44pxタッチ領域、#500 のnative dialog、#512 のVillage初回導線、#492 のDemon movement-only browser契約は現develop側を継承する。

## 記録ルール

`static review`、`browser playtest`、`DEV browser verified` を混同しない。実プレイ所見と改善内容は、この文書を同じ作業PR内で更新して残す。
