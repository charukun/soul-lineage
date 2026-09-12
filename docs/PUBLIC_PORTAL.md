# WAYFINDER / Public Gallery

`WAYFINDER` は、輪廻転焦とは切り離した一般公開向けのリンクギャラリーです。公開プロジェクトを普通のリンク一覧として並べず、スクロールで展示室を移動していくような体験として見せます。

## 掲載方針

- 輪廻転焦、soul-lineage、Bloodline Legacy、Rinne Ops Board、Visual Review Labなど、輪廻転焦に関係する公開先は掲載しません。
- 別プロジェクトの公開サイトまたは公開Repositoryだけを掲載します。
- 公開アプリURLをRepositoryから確定できない場合は推測で作らず、公開Repositoryを入口にします。
- 認証情報やSecretsはブラウザへ出しません。
- PWA化・インストール導線は持たせません。

## 表現

- 固定Canvasで奥行きのある展示空間を描画します。
- スクロール量を移動距離として扱い、各プロジェクトの展示室で一度停止して紹介します。
- 普通のヘッダー / メイン / ナビゲーション中心のレイアウトは使いません。
- `prefers-reduced-motion` では強いモーションを抑えます。

## リッチプレビュー

Cloudflare Worker `portal/worker.mjs` がサーバー側でリンク先を取得し、Open Graph / Twitter Cardメタデータを読みます。

利用する情報:
- title / description
- `og:image` / `twitter:image`
- `og:video` / `twitter:player`
- canonical URL / site name

YouTube URLは動画IDからサムネイルと埋め込みURLを組み立てます。リンク先がプレビュー取得を拒否する場合は、設定された `fallbackPreviewUrl` を使います。

## 共有

- ページ全体に目立つ `SHARE` / `COPY URL` を常設します。
- 各展示室にも `OPEN` / `SHARE` / `COPY LINK` を置きます。
- 対応ブラウザでは Web Share API を使用し、非対応時はクリップボードコピーへフォールバックします。

## データと公開

掲載項目の正本は `portal/catalog.json` です。

Cloudflare Workers + Static Assets の専用Worker `wayfinder-gallery` へ公開し、`/api/catalog` のみWorkerを先に通します。静的HTML/CSS/JSとcatalogはAssetsから配信します。

公開URL:
`https://wayfinder-gallery.c-okamoto.workers.dev/`

外部サイトの一時停止でギャラリー自体が公開不能にならないよう、デプロイ前の外部リンク確認は警告扱いです。一方、WAYFINDER自身のトップページ、catalog、リッチプレビューAPI、faviconはデプロイ後に必須確認します。

`main` / Productionのゲーム内容は変更しません。
