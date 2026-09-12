# RINNE GATE / Public Portal

`RINNE GATE` は、誰でもアクセスできる公開アプリ・確認ラボ・運用ツールへの入口です。

## 方針

- 公開URLを確認できる実アプリだけを `PLAY / LAB / TOOLS` に掲載します。
- 公開Repositoryは存在するが公開アプリURLを確認できない別プロジェクトは `SOURCE` に分離します。
- DEVは開発中の公開版として明示します。
- 認証情報やSecretsは含めません。
- PWA化・インストール導線は持たせません。

## データ

掲載候補は `portal/catalog.json` を正本とします。デプロイ前にGitHub Actionsから `verify: true` の全URLへHTTPアクセスし、到達できないリンクが1つでもあれば公開を止めます。

## 公開

Cloudflare Workers Static Assets の専用Worker `rinne-portal` へ公開します。`main` / Productionのゲーム内容は変更しません。
