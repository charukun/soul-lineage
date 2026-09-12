# 実装WORKのクイックスタート

正本: [WORKの分担](DEVELOPMENT.md) / [Integration](INTEGRATION.md) / [スマホ完結ハイブリッド開発](MOBILE_HYBRID_DEVELOPMENT.md)。

```sh
git fetch origin
git switch -c feat/my-change origin/develop
# コード修正前に最小の意味ある文書差分をcommit/pushしDraft PRを作る
# 詳細はDEVELOPMENT.md。文章のみのタスクはDraft作成対象外
npm ci
# 実装し、変更をcommitしてから現在headを検証
node scripts/validate.mjs fast origin/develop HEAD
npm run push:route -- origin/develop HEAD
```

`PUSH_ROUTE=WORK_CONNECTOR_OK`でも通常gitを第一経路とし、失敗時はGitHub連携/APIへ切り替えます。`PUSH_ROUTE=CODESPACES_GIT`または容量・Base64・payload上限系エラー時は、そのbranchをGitHub Codespacesで開き、通常`git push`へ即時切り替えます。100 MiB超の単一ファイルは通常Gitへpushせず、Git LFS等へ移します。

コード変更前のbranch push・Draft PR作成と本文先頭2行は [DEVELOPMENT.md](DEVELOPMENT.md) に従います。変更した機能の局所確認を済ませ、develop向けPRをReady for reviewにします。PRには理由・影響app/package・実行した検証・依存PRを記載します。未完了や仕様判断待ちはdraftまたはintegration:hold。

実装WORKはReady化後、branch・SHA・PR URL・高速検証結果を報告して終了。CI完了の同期待機・反復ポーリングは禁止。既知の失敗を短時間で単発確認することだけ許容します。CI監視・merge・DEV反映はIntegrationが担当し、CI失敗時のみ必要な修正をワーカーへ返します。PR作成時に毎回重い全ゲームのブラウザ検証を実施する必要はありません。
