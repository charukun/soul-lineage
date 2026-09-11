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

ゲーム仕様の対応表は [REQUIREMENTS](docs/REQUIREMENTS.md)、統合境界・保存・検証は [INTEGRATION](docs/INTEGRATION.md) を参照してください。

画面テストをネイティブURLで再実行する場合は、Python PlaywrightとChromiumを用意し、別プロセスで `npm run dev:village` を起動したうえで、進行テスト実行後に `python apps/village/tests/browser.py` を実行します。対象URLは `VILLAGE_URL`、任意のChromium実行ファイルは `CHROMIUM_EXECUTABLE` で指定できます。生成物はroot `test-results/village/` に保存されます。Chromiumは実WebGLで起動します。SwiftShaderを使う場合は機能確認であり、実端末の性能測定ではありません。

`built-browser.py` はビルド済みの `dist/village` を一時HTTPサーバーで配信し、起動・保存再読込・破損保存の保護と退避・実WebGL context lossを検証します。同じPython Playwright/Chromiumを使用し、サーバーはテスト終了時に停止します。
