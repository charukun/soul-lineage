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

## 操作レビュー後の受入条件（2026-09-12）

機能を増やすより、表示の正確さと確認操作の継続性を優先します。

- 同期失敗・古いスナップショット・現在のCI失敗を「要対応」に表示する。未確認を正常扱いしない。更新ボタンの近くに最終取得の経過時間を表示し、大きな全体サマリは復活させない。
- PRの対象アプリはサーバー側で変更ファイルから判定し、head/base SHAに紐づけて保存する。状態フィルタ操作からブラウザがGitHub APIを直接呼ばない。失敗時は未取得を明示し、更新されていない結果を現headの結果として扱わない。
- アプリ一覧は3列を維持し、アイコン・名称・環境・状態を読みやすくする。SHA・公開日時は開いて確認できるようにする。
- 手動・自動更新とも、選択中フィルタ、開閉状態、読んでいる位置を維持する。
- 先頭2行契約のない旧形式PRは、PR titleと本文概要へfallbackする。PR本文そのものは変更しない。
- 現在の失敗と、キャンセル・後続成功で解消済みの履歴を分ける。キャンセル単独を障害と断定しない。
- 名称・環境の整合性を扱うPR #89とは重複作業をしない。main / Production、ゲーム、Visual Review Lab、公開リンク集の内容は変更しない。

## 名称と3環境

ゲーム名は各workspaceのdisplayNameを正本とし、古い公開manifestの名前で上書きしません。各ゲームに開発・検証・本番を常に表示し、未登録は「未公開」、情報の重複や不正なパスは「確認中」としてリンクを有効化しません。環境全体が混在SHAでも各アプリの実公開SHAを表示します。検証版は固定リリースであり、DEVの次の更新で自動上書きしません。詳しくは GAME_ENVIRONMENTS.md を参照してください。Worker名rinne-ops、URL、workflow名は互換性のため維持します。

## 公開後検証と復旧

公開前に変更対象の単体テストとスマホ操作テストを行います。配信後は静的な `version.json` とWorkerの `/api/version` の双方を今回のcommitと照合してから、認証済みのサーバー間refreshで初期同期します。旧Workerの応答や古いスナップショットを新実装の成功として扱いません。公開APIのschema、同期状態、対象アプリ取得状況、現在の名称と3環境も検証し、公開ブラウザで同じ操作を再確認します。

GitHub取得失敗時にも既存の公開manifest fallbackを維持します。公開アプリの名称と環境だけが更新できた場合、GitHub履歴の取得日時は変更せず警告を残します。キャンセルと意図的なIntegration保留は障害や自動統合滞留として誤分類しません。
