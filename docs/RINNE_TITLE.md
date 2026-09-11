# 輪廻転焦のタイトルとスキルシミュレーター

`apps/rinne` は縦持ちを主軸としたタイトル画面。動的背景はユーザー承認済みKey Visualと軽量WebGL2シェーダーで構成する。立体モデルの村を新規制作したものではなく、画像ベースのカメラ/霧/光の合成。独立Canvasの文字と粒子、HTMLのロゴ/ボタンを重ねる。

## 責務

- `src/title/state.js`: portableな状態遷移と設定検証。
- `src/title/controller.js`: Web用のDOM/履歴/storage/lifecycle/iframe接続。
- `src/title/world.js`, `particles.js`, `audio.js`: タイトル専用表示/音声Adapter。
- `public/title-assets`: image provenance、背景、紋章。
- `public/simulator`: Library由来の既存Tidebreak Expanded Web runtime。

新たなクロスapp importやpackageの逆依存はない。既存sharedEmblemUrlは `@soul/assets` 公開exportから取得する。タイトルはゲームモデルを読み込まない。実ゲームの入口は相対 `./simulator/index.html`。base pathを `/dev/` に固定せず、Viteの相対baseに従う。

## 状態とlifecycle

`intro → title → loading → playing`。エラー時は `error` からリトライ/タイトル復帰可能。
iframeは毎回新規に作る。readyは実際の `__ATELIER__.snapshot().ready` に依存し、固定時間で成功扱いにしない。メッセージはwindow.source/originとrequest tokenを照合。キャンセルされた読み込みの完了は採用しない。戻ると元の戦闘は終了する。既存シミュレーターの保存仕様は維持する。

タイトルの音は初期オフ。明示操作後にWeb Audioの小さなオリジナル音列を再生。ゲーム画面/非表示時停止。ゲーム自身の音は既存設定。prefers-reduced-motionと明示設定を提供する。

タイトルのWebGL2初期化に失敗した場合は静止背景と明示的エラーを表示し、renderer=readyを偽装しない。シミュレーターもWebGL2必須。

## テスト

`node --test apps/rinne/tests/title.test.mjs`。
公開browser gateはrinneだけをタイトル＋実ゲーム起動＋実戦に変更。village/demonの共通ワールド検証とlegacy環境の検証は維持。`version.json` と画面のcommitはCIから注入された値を使う。

## AssetとPlatformの範囲

モデル/VRMA/音源のバイトは元Expandedと同一。モジュールのbare importを同梱vendorへの相対パスに変更し、CIの正規表現スキャナに誤認される一部ドキュメント/警告文を整えた。元ゲームHTMLへの追加は `title-bridge.js` の読込のみ。ゲーム判定・敵・カメラ・技データを変更していない。

Legacy runtimeはWeb用の移植境界であり、全ゲームルールのnative対応/Platform port化が完了したものではない。元の保存キーは保持しており、クロスセーブ/アカウント/Production用の保存移行は別途設計する。モデルの条件は `public/simulator/licenses` を参照。モデルの単体販売物として配布しない。
