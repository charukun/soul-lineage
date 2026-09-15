# 輪廻転焦 — 3ゲーム共通開発基盤

`charukun/soul-lineage` は「輪廻転焦」（旧名：魂の系譜）・村ハウジングゲーム・魔物側ゲームのmonorepoです。魔物側の `apps/demon` は「尽喰廻遊」の単独狩りを実装しています。輪廻転焦と村の入口は現在のdevelopの雛形を維持しています。認証・実プレイヤー対戦・共有村サーバーは未接続です。魔物側の実装範囲と残作業は [魔物ゲーム統合](docs/demon/INTEGRATION.md) を参照してください。

| ゲーム | ソース | DEV URL | 将来のProductionパス |
| --- | --- | --- | --- |
| 輪廻転焦 | `apps/rinne` | https://charukun.github.io/soul-lineage/dev/rinne/ | `/prod/rinne/` |
| 村ハウジングゲーム | `apps/village` | https://charukun.github.io/soul-lineage/dev/village/ | `/prod/village/` |
| 魔王軍ゲーム | `apps/demon` | https://charukun.github.io/soul-lineage/dev/demon/ | `/prod/demon/` |

既存 `/dev/` は輪廻転焦へ転送します。現在の `/prod/` はmainの既存実装を維持します。mainへ各appを昇格すると、対応するProductionパスを自動検出します。URLは公開・ログイン不要です。

## 開発・独立build

輪廻転焦本編への仕様導入は [血脈の系譜からのゲーム仕様抽出・適用差分](docs/rinne/BLOODLINE_GAMEPLAY_SPEC.md) を参照してください。血脈の系譜のコードは移植せず、現行優先の独自実装です。出生・生活・前線・救助・転生とMURAAAAAAAの配置接続は [本編と共有世界](docs/rinne/MAIN_GAME.md) を参照してください。

Node.js 24 / npm 11、npm workspacesと既存のViteを使用します。

```sh
npm ci
npm run dev:rinne       # :5173
npm run dev:village     # :5174
npm run dev:demon       # :5175
npm run build:rinne     # dist/rinne/index.html
npm run build:village   # dist/village/index.html
npm run build:demon     # dist/demon/index.html
npm run build          # すべて（共有package単独のbuildは不要）
npm run check
npm test
npm run test:app -- rinne
npm run affected -- origin/develop HEAD
```

各 `dist/<app>/` は相対URLで完結する静的成果物です。別ホスト・CDNにもそのまま配信できます。`version.json` のapp・environment・commit・inputHashで実際のbuild元を照合できます。変更のないアプリでは元のbuild SHAを保持します。

## 共有packages

| Package | 責務 |
| --- | --- |
| `characters` / `animations` | 安定したIDによる共通キャラクター・モーション登録口 |
| `assets` | 家具・建物の定義と共通画像。3アプリが同じ紋章SVGとベンチ定義を利用 |
| `world` | 共通村データ、schema/revision・Asset参照の検証、独立したコピーの取得 |
| `audio` | 共通音声catalogの登録口 |
| `rendering` | WebGL / Three.js表示Adapter。ゲームルールを持たない |
| `network` | PlatformのHTTPポートに依存する通信クライアント |
| `shared-ui` | Web向け表示・スタイルのみ |
| `game-data` | 共通content/protocol/save versionとPlatform非依存の保存形式 |
| `platform` / `platform-web` | Platformの契約とWeb実装。詳細は[Platform方針](docs/PLATFORMS.md) |

ゲーム本体は `apps/<app>/src/app.js` または `src/game/` に置き、Platform APIを直接呼びません。`src/main.js` は各Platformの起動・表示を接続する場所です。アプリ間の直接importとpackageからappへの依存をcheckで禁止します。

共通の雛形は `packages/world/data/villages/foundation.json`。MURAAAAAAA本編の共通地形・カタログ・初期配置は `packages/world/src/mura/`、描画モデルと地形は `packages/rendering/src/mura/` が正本です。メートル・右手系Y-up・安定したentity ID / asset ID / schemaVersion / revisionを使用します。配信する初期world templateと、ユーザーが変更した保存データを分離してください。共有packageは同一データ参照を提供しますが、サーバー間同期や共有ユーザー状態を自動的に実装するものではありません。

## CI/CD

- 実装WORK: コード修正前Draft PR → 実装・影響範囲の高速検証・push・Ready化で終了し、CI完了を待機・反復ポーリングしません。高速gateは1runnerでinstall・共有テストを重複させません。
- Integration: Ready後のCI監視を担い、失敗時のみ修正をワーカーへ返します。Ready PRを安全条件で判定し、developへまとめて統合。最終SHAで影響範囲の高速検証・DEV公開・公開HTTP/source照合を実施します。重い全体回帰・実Chromium/WebGL2・P2Pは必要時の別jobへ分離します。
- 変更appのみbuildし、不変appとProductionの公開済み成果物をhash検証して保持。同じ最終SHAが検証済みなら重複実行を省略します。
- 既存Pages・OIDC・GITHUB_TOKENを利用。main/Productionはdevelop Integrationで変更しません。
- 運用の正本: [WORKの分担](docs/DEVELOPMENT.md)、[自動Integration・停止・復旧](docs/INTEGRATION.md)。

詳細: [CI/CD運用](docs/MONOREPO.md)。[GitHub Pages公式Workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)、[Vite相対base](https://vite.dev/config/shared-options#base)。

## ゲームの追加

```sh
npm run app:add -- fourth "新しいゲーム"
npm install --package-lock-only
npm ci
npm run build --workspace @soul/fourth
```

テンプレートは稼働ゲームから独立した `templates/app/`。workspaceを追加すれば影響判定とDEV公開先 `/dev/fourth/` は自動認識します。共通packageの利用は各appのpackage.jsonへ明示します。

## 開発・検証・本番の整合性

各ゲームの環境構成・初回補完・固定リリースの更新方法は [環境運用](docs/GAME_ENVIRONMENTS.md) を正本とします。従来表の「将来対応」は初回補完前の表記です。公開済み判定は PULSE と公開manifestで確認してください。
