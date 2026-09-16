# 星継ぎの庭 — 輪廻転焦 Village

`Hoshitsugi_Village_LifeAndGuard_Package.zip` の生活・建築・守りを、既存の `apps/village` に統合したローカル村づくりゲームです。独自の配信基盤や別エンジンは追加しません。

Repository root から Node.js 24 / npm 11 で実行します。

```sh
npm ci
npm run dev:village
npm run check -- village
npm run test:app -- village
node apps/village/tests/progression.mjs
npm run build:village
python3 apps/village/tests/built-browser.py
```

入口は既存の `/dev/village/`、出力は `dist/village/` のままです。この実装WORKはReady PRまでを担当し、merge・DEV公開・公開URLの最終検証はIntegration側です。

- `src/game/`: 地形配置、資材・建材、住民、人口、野生動物、護衛、AI襲撃、保存。DOMから分離。
- `src/web/`: 描画・入力・UI。共有 `@soul/rendering` のThree.jsとGeometry utilityを使用。
- `src/main.js`: 読込進捗、エラー、再試行、破損セーブの退避。
- `tests/`: 元の64件のゲームルールと保存保護の回帰テスト。進行テストの出力はroot `test-results/village/`。
- `public/licenses/`: 配信にも含める利用条件。由来は `docs/ASSET_PROVENANCE.json`。

## 村の出来事表示

日常の出来事はゲーム画面を遮断しないことを基本とし、短時間の小型表示へ集約します。連続した日常イベントはまとめ、未確認件数は小さな印で示し、詳細はプレイヤーが任意に「村の年代記」として開いて確認します。脅威・死亡など重要度の高い出来事も原則としてフルスクリーン通知で操作を止めず、必要な注意喚起だけを強めます。

受入条件は次のとおりです。

- 日常イベントの発生だけでメイン画面を覆うモーダルを開かない。
- 「村人の様子」を含む自動発生の情報は画面中央へポップアップせず、端の短い便りまたは年代記へ集約する。
- 短時間に複数発生した出来事は画面上で集約し、同じ種類の通知連打を避ける。
- 未確認の出来事数を常設の小型UIで確認でき、そこから年代記を任意に開閉できる。
- 年代記には保存済みの `news` を時系列で表示し、通常プレイは背後で継続する。
- 脅威・死亡などの重要イベントは通常イベントより強く見せるが、全面遮断を既定にしない。

ゲーム仕様の対応表は [REQUIREMENTS](docs/REQUIREMENTS.md)、統合境界・保存・検証は [INTEGRATION](docs/INTEGRATION.md) を参照してください。

画面テストをネイティブURLで再実行する場合は、Python PlaywrightとChromiumを用意し、別プロセスで `npm run dev:village` を起動したうえで、進行テスト実行後に `python apps/village/tests/browser.py` を実行します。対象URLは `VILLAGE_URL`、任意のChromium実行ファイルは `CHROMIUM_EXECUTABLE` で指定できます。生成物はroot `test-results/village/` に保存されます。Chromiumは実WebGLで起動します。SwiftShaderを使う場合は機能確認であり、実端末の性能測定ではありません。

`built-browser.py` はビルド済みの `dist/village` を一時HTTPサーバーで配信し、起動・保存再読込・破損保存の保護と退避・実WebGL context lossを検証します。同じPython Playwright/Chromiumを使用し、サーバーはテスト終了時に停止します。

## フレーム時間の安定性

構造的な性能改善では、村の変更時に無関係な建物・室内まで作り直さず、描画品質や地形の診断も変更のあった対象に限定します。住民が増えた場合の表示補助は全住民同士の比較を毎フレーム繰り返さず、移動・建築・入室・保存の正しさを維持して処理量を抑えます。変更前後を同じシーンで比較し、生成・破棄や走査回数と実際の描画負荷を記録します。

経路探索の共有フロー場は、目的地から要求元に届くところまで展開し、同じ目的地への次の要求で探索を再開します。地形・足跡のrevision、壁・入口の衝突判定、探索上限、既存経路へのfallbackは維持します。描画は建物・家具のIDと形状・位置の差分で更新し、非同期モデルの追加・削除時だけシーン診断を無効化します。品質の負荷分類は12フレーム継続してから切り替え、一時的な揺れで描画バッファを作り直しません。

再現用のCPU負荷比較は `node apps/village/tests/runtime-budget.bench.mjs <変更前のgit ref>`。`46b070d` との同一24経路では経路を変えず障害物判定が1,728,024回から5,770回へ、96人の近隣比較は9,120回から344回へ減少しました。合成条件での処理回数であり、実端末FPSの保証ではありません。差分更新の回帰テストは、建物・家具・室内の参照維持、移動、建築段階、撤去、植生の除外範囲、同内容の保存再読込を検証します。

通常プレイでは、性能記録のために毎フレーム統計用の全サンプルをソートしません。フレーム値は従来どおり記録し、診断要求時に集計します。また、描画品質の再適用で異方性設定が変わらないテクスチャはGPUへ再転送せず、実際の設定変更・テクスチャ内容更新は維持します。性能修正は局所的な回帰テストと処理回数で検証し、Node.jsの処理時間やソフトウェアGPU上の結果をスマートフォン実機のFPSとして報告しません。
