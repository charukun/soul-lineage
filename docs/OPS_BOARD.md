# PULSE

`PULSE` は、輪廻転焦の公開状態と Integration の詰まりをスマートフォンから確認するための read-only 運用ダッシュボードです。

## 正本

表示値は GitHub API、GitHub Actions、公開済み `deployment-manifest.json`、公開用 commit status を正本とします。branch の先端と公開済み SHA は別々に扱い、branch に merge 済みでも公開 manifest が更新されていなければ deploy 済みとは表示しません。古い Production manifest で単一 SHA を確定できない場合も推測しません。

## 公開環境

- DEV / Production: GitHub Pages の公開 `deployment-manifest.json` と Repository branch を照合します。
- Visual Review 等: GitHub Actions の review / preview 系 workflow と `*/public` commit status を検出します。
- Ops Board 自体: Cloudflare Worker `rinne-ops` と Static Assets で公開します。

各環境は deploy 状態、公開済み SHA、deploy 日時、反映済み PR 件数と一覧を表示します。PR 一覧は公開 SHA から到達可能な GitHub merge commit を根拠に生成します。

## 開発ツール

PULSE の「開発ツール」には、独立した公開先だけでなくゲーム配下の検証・制作画面も登録できます。キャラクター工房は `apps/rinne/characters.html` を正本とし、輪廻転焦 DEV の公開 manifest に `rinne` が存在するときだけ `dev/rinne/characters.html` を公開中として表示します。公開 SHA と更新日時は同じ DEV manifest entry から取得し、URLだけを推測して公開扱いにはしません。

## 更新

Cloudflare Cron Trigger が5分ごとに Durable Object のスナップショットを更新します。GitHub Actions の Integration / DEV deploy 完了時にも、Worker 内だけが知る refresh token を使って再同期します。ブラウザへ GitHub/Cloudflare の認証情報は渡しません。

UI は1分ごとに保存済みスナップショットを再取得します。これは GitHub API の再同期ではないため、閲覧数で GitHub API 呼び出しが増えません。

## Integration 滞留

Open develop PR の CI と Integration workflow を照合し、Ready + 必要 CI 成功後も10分以上 open の PR を赤警告にします。状態は Ready for review待ち / Integration中 / CI失敗 / merge待ち / deploy待ち / Failed に分類します。既存 Integration の merge/retry ロジックを変更せず、Board は監視専用です。

## Secrets

Cloudflare deploy は既存 Repository Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を Actions runner 内だけで利用します。Ops refresh token は API token から一方向に導出し、Worker の server-side variable として渡します。静的 UI と `/api/state` に secret は含めません。

## 操作レビュー後の受入条件（2026-09-13）

- 同期失敗・古いスナップショット・現在のCI失敗は上部の「要対応」に出し、未確認を正常扱いしません。最終取得の経過時間も上部に表示します。
- PRの対象アプリはWorker側で変更ファイルから判定・保存し、ブラウザの状態フィルタ操作でGitHub APIを直接呼びません。
- アプリ一覧の3列は維持しつつ、主要文字をスマホで読めるサイズにし、SHA・公開日時など詳細値は「公開の詳細」へ集約します。
- 手動・自動更新後も状態フィルタ、開いていた詳細、読んでいる位置を可能な範囲で維持します。
- 先頭2行契約のない旧形式PRは、構造的な見出しを表示名に使わず、PR titleと本文概要へfallbackします。
- 現在対応が必要な失敗と、キャンセル・旧head・後続成功済みの履歴を分離します。
- 名称・環境の整合性は既存の別作業を正本とし、main / Production、ゲーム内容、Visual Review Lab、公開リンク集の内容は変更しません。

## 名称と3環境

ゲーム名は各workspaceのdisplayNameを正本とし、古い公開manifestの名前で上書きしません。各ゲームに開発・検証・本番を常に表示し、未登録は「未公開」、情報の重複や不正なパスは「確認中」としてリンクを有効化しません。環境全体が混在SHAでも各アプリの実公開SHAを表示します。検証版は固定リリースであり、DEVの次の更新で自動上書きしません。詳しくは GAME_ENVIRONMENTS.md を参照してください。Worker名rinne-ops、URL、workflow名は互換性のため維持します。
