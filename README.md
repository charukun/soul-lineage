# 輪廻転焦 — 3ゲーム共通開発基盤

`charukun/soul-lineage` は「輪廻転焦」（旧名：魂の系譜）・村ハウジングゲーム・魔物側ゲームのmonorepoです。魔物側の `apps/demon` は「暗い喰らいCry」の単独狩りを実装しています。輪廻転焦と村の入口は現在のdevelopの雛形を維持しています。認証・実プレイヤー対戦・共有村サーバーは未接続です。魔物側の実装範囲と残作業は [魔物ゲーム統合](docs/demon/INTEGRATION.md) を参照してください。

| ゲーム | ソース | DEV URL | 将来のProductionパス |
| --- | --- | --- | --- |
| 輪廻転焦 | `apps/rinne` | https://charukun.github.io/soul-lineage/dev/rinne/ | `/prod/rinne/` |
| 村ハウジングゲーム | `apps/village` | https://charukun.github.io/soul-lineage/dev/village/ | `/prod/village/` |
| 魔王軍ゲーム | `apps/demon` | https://charukun.github.io/soul-lineage/dev/demon/ | `/prod/demon/` |

既存 `/dev/` は輪廻転焦へ転送します。現在の `/prod/` はmainの既存実装を維持します。mainへ各appを昇格すると、対応するProductionパスを自動検出します。URLは公開・ログイン不要です。

## 開発・独立build

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

共通村の正本は `packages/world/data/villages/foundation.json`。メートル・右手系Y-up・安定したentity ID / asset ID / schemaVersion / revisionを使用します。配信する初期world templateと、ユーザーが変更した保存データを分離してください。共有packageは同一データ参照を提供しますが、サーバー間同期や共有ユーザー状態を自動的に実装するものではありません。

## CI/CD

- PR: app変更は該当app、package変更は推移的に依存するappと変更packageを検証。未使用packageは自身のみ。lockfile・基盤変更は全app。文書のみはbuild不要でも必須CI Gateを成功させます。
- develop/main更新: 直列化した後に両ブランチの最新HEADを取得。前回公開manifestと各appの入力hashを比較し、変更appのみinstall/check/test/buildします。
- 変更のないappは公開済み成果物をSHA-256検証して再利用。すべて不変なら公開も省略。初回やmanifest未作成の場合は各環境を一度buildします。
- Pagesの既存設定・OIDC・Actions tokenを再利用。追加サービス・APIキー不要です。
- GitHub Pagesはサイト単位で入れ替わるため、最後のupload/deployは全URLを含む単一snapshotです。変更のないappを再buildせず、前回内容をそのまま含めます。
- 配信前の取得・build・検証失敗時は配信せず、直前の公開内容を維持します。配信後は公開HTTPで各入口、JS/CSS/SVG、SHAを検証します。
- 配信後は変更appだけを実Chromiumで開き、WebGL2起動・表示・共有Asset・commitを検証します。結果と画面をActions Artifactに保存します。CIの描画はSwiftShaderを使うため、実機性能の測定ではありません。
- Productionはmainに含まれるコードのみ。mainの旧構成にも対応し、DEVからProductionへの自動昇格は行いません。
- 両ブランチのdeploy workflowを同じ内容に保ちます。実行coordinatorは最新developから読みますが、Productionのbuildコマンドとソースはmainから実行します。

詳細: [CI/CD運用](docs/MONOREPO.md)。[GitHub Pages公式Workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)、[Vite相対base](https://vite.dev/config/shared-options#base)。

## ゲームの追加

```sh
npm run app:add -- fourth "新しいゲーム"
npm install --package-lock-only
npm ci
npm run build --workspace @soul/fourth
```

テンプレートは稼働ゲームから独立した `templates/app/`。workspaceを追加すれば影響判定とDEV公開先 `/dev/fourth/` は自動認識します。共通packageの利用は各appのpackage.jsonへ明示します。
