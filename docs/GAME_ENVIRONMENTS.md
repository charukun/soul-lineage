# ゲーム環境運用 / PULSE

## 正本

ゲームの現在名は `apps/*/package.json` の `displayName`。PULSEとViteは `scripts/application-catalog.mjs` を共有する。旧公開物の `version.name` で現在名を上書きしない。技術ID、保存データキー、既存URLは改名しない。

PULSEの表示名は `PULSE`。内部Worker名 `rinne-ops`、既存URL、workflow名 `Rinne Ops Board` は連携互換性のため維持する。Visual Review Lab / WAYFINDERに説明括弧は付けない。

## 3環境

| 用途 | manifest environment | 配置 | 更新 |
| --- | --- | --- | --- |
| 開発 | dev | dev/{app}/ | 通常Integrationで最新developを公開 |
| 検証 | staging | staging/{app}/ | 初回作成後は固定。明示的なrefresh_stagingで更新 |
| 本番 | prod | prod/{app}/ | 初回補完後は固定。本番更新は従来の承認済みmain昇格 |

輪廻転焦の既存本番は移行前の `prod/` を引き続き正しい公開先とする。新しい同名本番へ無断で置換しない。

## 今回の不足補完

2026-09-12のユーザー依頼に基づき、初回補完対象は rinne / village / demon に限定する。新規workspaceを追加しただけで自動的に本番公開はしない。

developの配信時に `INITIALIZE_GAME_ENVIRONMENTS=true` を指定する。公開manifestに存在しない `(app, environment)` だけを、検証対象のdevelopソースから環境別にビルドして追加する。既存本番のファイル・SHAはそのまま復元し、公開ファイルとのパス衝突はエラーにする。既存の単体・アプリ検証、HTTP/ソース検証、changed-targetの実ブラウザ検証を省略しない。

補完した検証・本番には `pinned: true` を記録する。通常のDEV更新でも、旧形式mainの配信でも、明示的な置換対象でない固定リリースを削除しない。本番内で旧rinneと新しい他ゲームのSHAが異なる間は、単一のmain SHAに統一されたように表示しない。各アプリの実公開SHAを正本とする。

## 検証版の更新

既存 `Deploy DEV and PROD` workflowをdevelopで手動実行し、`refresh_staging=true` を指定する。対象ゲームの検証版のみ更新し、本番の既存リリースは保持する。DEVの更新を検証版へ勝手に追従させない。

## 公開判定

PULSEは全ゲームに開発・検証・本番を表示する。manifest未登録は「未公開」で、推測URLを有効リンクにしない。重複や不正パス、SHA欠損は「確認中」。公開済みの個別SHAと更新待ち状態は区別する。

公開環境の監査は `PULSE public environment audit` workflowで行う。監査ジョブ自体の成功は「全環境が公開済み」を意味しない。ログの `ENVIRONMENT_COVERAGE` とmanifest/HTTPの各行を確認する。

## 修正前の実測

2026-09-12 09:03 UTC、Actions run 34684834589 / job 103529903275 による公開HTTP監査。

| ゲーム | 開発 | 検証 | 本番 |
| --- | --- | --- | --- |
| 輪廻転焦 | 200 / 登録あり | 404 / 未登録 | 200 / prod/ の旧版 |
| 尽喰廻遊 | 200 / 登録あり | 404 / 未登録 | 404 / 未登録 |
| MURAAAAAAA | 200 / 登録あり | 404 / 未登録 | 404 / 未登録 |

不足は5環境。DEV公開SHAは d6c62fa401e3ceee31e37d990e2303909e3145b9、既存本番SHAは ffeec4c3e7402c619cd25dff6bff4894fb5e5709。demonのHTMLタイトルは「尽喰廻遊 | 人間狩りの夜」だったが、公開version.nameは「暗い喰らいCry」のままだった。改名PR #57は統合済みだがpackage metadataが未更新だった。

この表は修正前の監査記録であり、初回補完の完了宣言ではない。補完後の状態は公開manifestと配信検証結果で判定する。
