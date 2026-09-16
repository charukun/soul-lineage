# Consumer UI / Browser Chrome Policy

3ゲームの通常プレイ面はブラウザ上で動作していても、ブラウザやOSが所有する既定UIを作品の操作面として露出しない。`docs/PLATFORMS.md` の「コンシューマ向けゲームUI」を、入力部品と確認UIについて具体化する。

## 禁止する表示

- `alert()` / `confirm()` / `prompt()` など、サイト名と汎用OK/キャンセルを表示するブラウザ標準ダイアログ。
- 通常プレイの選択操作でOS/ブラウザのピッカーを開く可視 `select` や、未装飾の標準checkbox。
- `progress` / `meter` / `range` をブラウザ既定の見た目のまま露出すること。
- 作品世界と無関係な `WEBGL`、renderer/core名などの技術表示を通常プレイ画面の装飾として常設すること。

## 許可する実装

- semantic HTMLを維持した `progress` / `meter` / `range` は、各appがtrack・fill・thumb・focusを作品固有の見た目として所有する場合に使用できる。
- ファイル復元などのための hidden file input は、通常プレイ面へブラウザ既定UIを露出しないため対象外。
- 開発者専用診断面はconsumer UIとは分離する。ただし通常プレイから直接見える技術表示へ漏らさない。
- 取り消し不能・高リスク操作はapp-owned dialog/sheetで確認し、行為を表す具体的なラベルを使う。

## 今回の監査受入条件

- `rinne` / `village` / `demon` の通常入口、HUD、主要dialog/sheet、初回導線を確認する。
- native JS dialog の再混入経路を入口HTMLまで含めて検査する。
- 通常入口から可視 native choice control (`select`, checkbox) を排除する。
- 残す `progress` / `meter` / `range` は作品固有スタイルを持たせる。
- 通常画面に残る技術的なエンジン表示を作品内表現へ置き換える。
- hidden input、アクセシビリティ用semantics、開発者専用診断機能そのものは壊さない。
