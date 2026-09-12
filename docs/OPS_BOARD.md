# PULSE

`PULSE` は、輪廻転焦の公開状態と Integration の詰まりをスマートフォンから確認するための read-only 運用ダッシュボードです。

## 正本

表示値は GitHub API、GitHub Actions、公開済み `deployment-manifest.json`、公開用 commit status を正本とします。branch の先端と公開済み SHA は別々に扱い、branch に merge 済みでも公開 manifest が更新されていなければ deploy 済みとは表示しません。古い Production manifest で単一 SHA を確定できない場合も推測しません。

## 公開環境

- DEV / Production: GitHub Pages の公開 `deployment-manifest.json` と Repository branch を照合します。
- Visual Review 等: GitHub Actions の review / preview 系 workflow と `*/public` commit status を検出します。
- Ops Board 自体: Cloudflare Worker `rinne-ops` と Static Assets で公開します。

各環境は deploy 状態、公開済み SHA、deploy 日時、反映済み PR 件数と一覧を表示します。PR 一覧は公開 SHA から到達可能な GitHub merge commit を根拠に生成します。

## 更新

Cloudflare Cron Trigger が5分ごとに Durable Object のスナップショットを更新します。GitHub Actions の Integration / DEV deploy 完了時にも、Worker 内だけが知る refresh token を使って再同期します。ブラウザへ GitHub/Cloudflare の認証情報は渡しません。

UI は1分ごとに保存済みスナップショットを再取得します。これは GitHub API の再同期ではないため、閲覧数で GitHub API 呼び出しが増えません。

## Integration 滞留

Open develop PR の CI と Integration workflow を照合し、Ready + 必要 CI 成功後も10分以上 open の PR を赤警告にします。状態は Ready for review待ち / Integration中 / CI失敗 / merge待ち / deploy待ち / Failed に分類します。既存 Integration の merge/retry ロジックを変更せず、Board は監視専用です。

## Secrets

Cloudflare deploy は既存 Repository Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を Actions runner 内だけで利用します。Ops refresh token は API token から一方向に導出し、Worker の server-side variable として渡します。静的 UI と `/api/state` に secret は含めません。

## 名称と3環境

ゲーム名は各workspaceのdisplayNameを正本とし、古い公開manifestの名前で上書きしません。各ゲームに開発・検証・本番を常に表示し、未登録は「未公開」、情報の重複や不正なパスは「確認中」としてリンクを有効化しません。環境全体が混在SHAでも各アプリの実公開SHAを表示します。検証版は固定リリースであり、DEVの次の更新で自動上書きしません。詳しくは GAME_ENVIRONMENTS.md を参照してください。Worker名rinne-ops、URL、workflow名は互換性のため維持します。
