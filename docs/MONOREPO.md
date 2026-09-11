# monorepo運用

WORKの担当範囲と現在の自動統合は [DEVELOPMENT.md](DEVELOPMENT.md) と [INTEGRATION.md](INTEGRATION.md) を正本とします。以下の既存monorepo境界と配信保持の仕組みは継続します。

## 依存関係

npm workspaceのpackage.jsonに宣言した依存関係を正本とします。共通コードのコピー、別app内部への相対import、packageからappへの逆依存は禁止します。共有Assetを追加する場合もIDを付け、packageの公開exportを通じて参照します。ライセンスを同じpackageで保持し、必要な利用条件を配信成果物に含めてください。

Tidebreakなど既存ゲームを後から取り込む場合は `apps/rinne` が反映先です。rootのindex.html/src/publicへゲーム構成を戻したり、monorepoのCI/CDを単一app版で上書きしたりしないでください。現在進行中の別WORKは最新developと照合してから統合します。

`affected.mjs` はPRのbase/headを比較し、rename前後の両パスを評価します。共有packageのconsumerを推移的に展開します。不明パス・削除package・base不明・lockfileやCI/build基盤の変更は全appへ広げます。未使用の共通packageはpackage自身のcheck/testのみを実行します。

## 配信の状態と復旧

`deployment-manifest.json` は各公開appのinputHash、build時commit、全ファイルのSHA-256/sizeを持ちます。GitのイベントSHAだけではなく、各appと依存packageの内容をhash化します。ビルドに影響するroot設定・scripts・tests・lockfileも含めます。文書変更は除外します。

変更のないappは元のversion.jsonを保持するため、同じ公開snapshot内でappごとにbuild元SHAが異なることは正常です。ActionsのsummaryでBUILD/RETAINを確認できます。成果物のコピーはSHA-256検証を通る必要があります。ネットワークやmanifest取得の異常を、初回配信扱いして無視しません。

Pages全体が1単位のため、どれかのappのbuild/restoreが失敗すれば全体の更新を止めます。appごとの完全に独立した障害ドメインが必要になった段階では、同じdistを別の配信サービスに分けます。

復旧は正常commitへ戻す通常PR、またはActionsの手動再実行を利用します。最新develop/mainから状態を再計算します。前回のmanifestがない場合だけ全buildします。直列実行の同時配信グループ`pages`は維持してください。

## Productionへの昇格

今回のDEV移行だけでmainのゲーム本体は昇格しません。旧mainの互換配信を維持します。初期monorepo導入時にmain側のdeploy.ymlはcoordinator呼び出しへ同期済みです。通常のdevelop Integrationではmain側workflowを変更しません。

将来monorepoをmainへ導入すると各 `apps/*` を自動検出し `/prod/<app>/` に配信します。その後appごとにコードをmainへ昇格すれば、変更appだけを再buildします。共有package昇格時は依存するappも再buildします。必ずProduction向けPRとして内容をレビューしてください。

## 検証

- `npm test`: 影響判定、推移依存、cycle、不明パス、変更のない出力の保持、改ざん・path escape検出。
- `npm run check [-- app]`: 構文・依存宣言・workspace境界・portable層へのWeb API直接混入。
- `npm run test:app -- <app>`: appと推移依存packageのテスト。
- `npm run build:<app>`: 独立build、index/JS/CSS/共通SVG/version検証。
- 配信後HTTP gate: 各公開入口、JS/CSS/SVGの内容、各appのcommit/inputHash検証。
- 実ブラウザ: 各DEV URLでcanvasのrenderer=ready、world/asset ID、画像表示、console errorsを確認。
- Integrationの任意full_verification jobは全DEV appを対象に1ブラウザworkerで実行。従来のmain側配信は変更appのみの動作を維持。公開snapshotの実commitと照合し、HTTP成功だけで起動成功と判断しません。WebGL2を無効にした環境や初期化失敗を成功扱いするfallbackは設けません。スクリーンショットはActionsのpublic-browser-verification artifactに14日保持します。

3アプリの起動確認は基盤の検証です。将来追加するゲーム本体・ネイティブ実機の性能/認定テストの代わりにはなりません。

公開後のHTTP/browser gateが失敗した場合はActionsが失敗を報告します。公開そのものは既に行われているため、正常commitへの復旧PRが必要です。
