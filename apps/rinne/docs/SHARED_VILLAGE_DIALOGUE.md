# 共有村会話の契約

輪廻転焦と MURAAAAAAA は同じ村を扱うため、村の暮らし・施設・住民反応を説明する台詞の意味と、村内での台詞表示の基本挙動を各アプリへ重複定義しない。

## 正本

- 村会話の意味・定型文・施設トピックは `@soul/world/mura/dialogue` を正本とする。
- 村内の頭上吹き出し表示は `@soul/shared-ui/speech-bubbles` を正本とする。
- `apps/rinne` と `apps/village` はこれらの共有 package を直接利用し、互いの app を import しない。
- Rinne の出生期は、導入・施設案内・4歳の自立まで、村について話す文言を Rinne 内へ別コピーとして直書きしない。
- MURAAAAAAA の住民吹き出しのうち、共有村の暮らしを表す定型反応も同じ正本から取得する。

## 台詞表示

- Rinne の母・村人による村内台詞は、MURAAAAAAA と同じ共有吹き出し runtime を使い、発話者の頭上へ追従表示する。
- 共有 runtime が表示時間、同時表示数、既読 ID、画面外非表示、縮尺、出現表現を管理する。app 側は発話者の画面座標と、その画面で一時的に隠す条件だけを渡す。
- Rinne 固有の大型下部会話パネルを、村会話の代替 UI として使用しない。
- 村アプリ側も独自の吹き出し管理ループを持たず、共有 runtime を利用する。
- 発話者名などアプリ固有情報が必要な場面でも、共通の吹き出し挙動を別 UI に置き換えない。

## プレイヤー発話

- Rinne の能動発話は4歳の自立後かつ村にいる間だけ利用できる。行動不能・人生終了・前線では閉じる。
- 定型発話の intent / label / text は `@soul/world/mura/dialogue` を正本とし、Rinne 側は扇メニューの配置と入力処理だけを所有する。
- `SpeechRecognition` / `webkitSpeechRecognition` は Web UI adapter の任意機能として扱い、共有 package へ browser API を持ち込まない。
- マイク非対応・未許可でも定型文の扇メニューは残し、発話操作を不能にしない。
- 旧「話す」ボタンは復活させない。NPC の自発会話表示はプレイヤー発話UIと独立して維持する。

## 表現と意味の境界

共有吹き出し runtime は表示挙動を共通化し、各 app は Three.js / village renderer から発話者の頭上座標を解決する adapter だけを持つ。カメラや actor graph の実装差を共有 package へ持ち込まない。

施設案内は共有 MURA catalog の施設種別と矛盾しない topic だけを使う。Rinne 側で施設用途を言い換えた第二の台詞一覧を持たない。

## 回帰条件

- 両アプリが `@soul/world/mura/dialogue` と `@soul/shared-ui/speech-bubbles` を consumer として持つこと。
- Rinne の出生期ソースへ共有済み台詞の文字列コピーを再導入しないこと。
- Rinne の村会話が大型下部会話パネルへ戻らないこと。
- 両アプリの村会話が、共有 runtime の表示時間・同時表示数・画面外処理を通ること。
- 共有 topic は MURA catalog の施設種別と互換性を検査できること。
- MURAAAAAAA の既存 simulation / save / AI と、Rinne の年齢・移動・出生進行は会話共有のために変更しないこと。
