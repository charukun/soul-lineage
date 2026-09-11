# 実装WORKのクイックスタート

正本: [WORKの分担](DEVELOPMENT.md) / [Integration](INTEGRATION.md)。

```sh
git fetch origin
git switch -c feat/my-change origin/develop
npm ci
# 実装し、変更をcommitしてから現在headを検証
node scripts/validate.mjs fast origin/develop HEAD
```

変更した機能の局所確認を済ませ、develop向けPRをReady for reviewにします。PRには理由・影響app/package・実行した検証・依存PRを記載します。未完了や仕様判断待ちはdraftまたはintegration:hold。

実装WORKの最終報告はPR URLと高速検証結果。merge・全体回帰・DEV公開確認はIntegrationが担当します。PR作成時に毎回重い全ゲームのブラウザ検証を実施する必要はありません。
