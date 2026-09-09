# 魂の系譜 — Soul Lineage

WebGL2 / Three.jsのゲーム開発用リポジトリ。初期段階は白い空のシーンです。

| 環境 | URL | ソース |
| --- | --- | --- |
| DEV | https://charukun.github.io/soul-lineage/dev/ | `develop` |
| PROD | https://charukun.github.io/soul-lineage/prod/ | `main` |

ログイン不要で閲覧できます。リポジトリもPublicです。
各URLの `version.json` に環境名・実際のソースcommit SHA・ビルド日時・Actions run IDを自動出力します。
画面上にバージョン文字列は表示しません。ブラウザのタブ名でDEV/PRODを区別できます。

## 開発

Node.js 24とnpmを使用します。

```sh
npm ci
npm run dev
```

```sh
npm run check
APP_ENV=dev npm run build
npm run preview
```

`src/main.js` がゲームの開始点です。現時点ではThree.jsの白いシーンを初期描画し、ウィンドウサイズ変更時のみ再描画します。オブジェクト・ゲームUI・ゲームルールはまだありません。
相対baseでビルドするため、GLBやテクスチャなどの追加時にもURL先頭の `/` をハードコードせず、`import.meta.env.BASE_URL` かモジュール相対URLを使用してください。

## CI/CD

- `develop` / `main` 向けPR: 構文確認・依存関係の固定インストール・ビルド・生成物検証。
- `develop` / `main` へのpush: 最新 `develop` をDEV、最新 `main` をPRODとしてビルドし、自動配信。
- 手動再配信: Actions → Deploy DEV and PROD → Run workflow（mainまたはdevelop）。
- PRODのソース更新は `develop` から `main` へのPRをレビューしてmergeする。
- 配信後にログインなしのHTTPで両ページ・JS/CSS・version.jsonのSHAを検証する。
- GitHub Actionsの組み込みトークンとOIDCを利用。追加サービスや長期APIキーは不要。

GitHub Pagesは1リポジトリにつき1サイトのため、DEV/PRODは同じホストの別パスです。
1回の配信では両ブランチを別々にビルドし、1つの成果物にまとめて公開します。
DEVのコードがPRODに混ざることはありませんが、どちらかのビルドが失敗すると両方の更新を止め、直前の公開内容を維持します。
同時配信は直列化し、待機後に最新のブランチを取得することで古いpushによる巻き戻しを防ぎます。

現在は静的フロントエンドのみです。API・DB・保存・ログインを追加する段階で環境別のバックエンドを用意してください。
同一オリジンなので、将来localStorageなどを利用するときは環境別にキーを分ける必要があります。

## 初回のGitHub設定

Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定します。
`github-pages` environmentの許可ブランチは `main` と `develop` にします。
GitHubが初回にデフォルトブランチのみ許可する設定を作った場合も `develop` を追加してください。
Actionsの成功と、DEV / PRODの `version.json` を確認すれば配信元を照合できます。

## 参照

- [GitHub PagesのカスタムWorkflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Viteの静的配信](https://vite.dev/guide/static-deploy.html)
- [Three.js](https://threejs.org/)
