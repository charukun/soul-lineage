# develop Integration

## 起動と集約

PRの `Validate and build` 成功後、`Request Integration` が既存 `deploy.yml` を **developを指定してworkflow_dispatch** します。developへの通常pushも復旧・初回検証の入口です。mainに存在する既存workflowを利用するため、default branch変更やmainへの新workflow追加は不要です。

全Integration・Pages配信は既存の `pages` concurrency groupで直列化します。pendingイベントがまとめられても、各実行が現在の全Ready PRを再走査するため、特定イベントのPR番号に依存しません。上限8PR/バッチ、依存順を再評価します。残りは成功後に次のバッチを要求します。

mergeはGitHubのPR merge APIと実行のGITHUB_TOKENを使用します。途中のmergeからpush Workflowを発火させず、同じ実行で最終developを明示checkoutして検証・公開します。PAT・追加サービス・常駐pollingは不要です。

## 自動merge条件

- 同一Repositoryの信頼された寄稿者によるopen・非draft・develop向けPR。
- 現在のhead SHAに対応する `ci.yml` の最新runで `Validate and build` が成功。PR番号/headの検証artifactを照合。ほかのChecks/statusの失敗や未完了も保留。
- `Depends-On` の全PRがdevelopへmerge済み。曖昧・他repo参照は保留。
- GitHubがmerge可能と判定し、保護ルールが許可。未解決review threadとChanges requestedなし。
- 明示holdなし。基盤・自動化・運用制御ファイルの変更には、現在headへのmaintainer approvalが必要。
- PR分岐点からdevelopに入った変更と同じファイル/共有packageが重なる場合、Integration reviewが必要。
- merge直前にhead・Ready状態・label・body・review・Checks・develop SHAを再取得。head指定merge APIを使い、force pushや保護設定の緩和は行わない。

保護ルールはGitHub APIが最終的に強制します。現在のdevelopはbranch APIでは未保護と表示されており、管理権限がないため設定変更は行っていません。自動化独自の検証を実施しますが、管理者による手動pushを技術的に禁止するものではありません。

## 一人開発の所有者承認・手動Integration

共同maintainerがいない場合、所有者 `charukun` 自身のPRはGitHubの自己Approve制約により自動merge条件を満たせません。所有者が明示的に依頼したIntegrationでは、以下を正式な手動承認・統合経路とします。この手順の導入は、所有者がWORK上で承認した運用変更に基づきます。

1. 所有者が対象PRのdevelop統合を明示承認し、Integration担当が実際の差分をレビューする。既存セッションの明示承認は有効であり、同じ範囲について再確認を繰り返さない。
2. PRへ所有者承認の根拠、対象PR番号・完全なhead SHA、確認したCI run、差分レビュー結果を記録する。担当が代理記録したことを明記し、GitHubのAPPROVEDレビューや独立した他者レビューとして扱わない。
3. 同一Repository・所有者作成・非draft・develop向けであること、最新headのfast gateと検証artifact、他のChecks/status、依存PR、未解決thread・Changes requested・明示hold・競合を確認する。失敗や未完了を承認で無視しない。developの直前Integration成功を確認し、失敗中は既存の修復手順に従う。
4. developがPR分岐点以降に変更されていれば差分を照合する。merge直前にhead・base・Ready状態・label・body・review・Checksを再取得し、変更があれば再評価する。head変更前の確認記録を新しいheadへ流用しない。
5. Integration担当が通常のPR merge APIに `expected head SHA` を指定してdevelopへmergeする。GitHubが要求する保護ルールはそのまま適用し、拒否されたら停止する。force push、admin bypass、保護設定の緩和は行わない。
6. developへのpushで既存Deployを起動する。起動しなければ既存CIの `Request Integration` jobを再実行してdevelopへのdispatchを要求する。最終SHAの `integration/develop=success` と該当runのDEV配信・公開検証結果まで確認する。main / Productionは変更しない。

自動Integrationの `reviewDecision` と自動merge条件は変更しません。所有者のコメント・labelだけで自動承認を生成しません。通常の実装WORKは引き続きReady PRまで、所有者承認を受けたIntegration WORKがこの手動経路を担当します。今回の手順追加PRも、所有者の導入承認を記録し、同じCI・差分確認・head指定merge・公開検証を経て統合します。

## 最終検証と配信

1. 現在SHAに成功した最終結果がなければ、最初にそのdevelopを検証して基準を確立。失敗後は `integration:repair` を付けた修復PRだけが自動統合候補となり、通常の安全条件も満たす必要があります。
2. 最終SHAをcheckout。installは1回、全workspaceの構文/境界検証、全root/共有/appテストを重複なく実行。
3. 既存inputHashで変更appのみbuild。変更なしはSHA-256検証して公開済み成果物を復元。統合テストで使ったbuildをPagesへ配信し、再buildしない。
4. DEV-only配信ではProductionの公開manifest・全ファイルをそのまま保持し、mainのコードをbuild/昇格しません。Productionの基準manifestが取得できなければ停止。
5. 配信直前にdevelopが進んでいないことを確認。公開HTTP・assets・commitを検証し、最終DEVの全ゲームを実Chromium/WebGL2で確認。スクリーンショットと結果を14日保持。
6. **全部成功した時だけ** 最終SHAの `integration/develop` をsuccessにします。同じSHAを再要求された場合、重複する全体検証・build・公開を省略。

appが無変更ならversion.jsonの元のbuild SHAを保持します。最終developとの整合はinputHashとdeployment-manifest.jsonのvalidatedDevelopで追跡します。manifestは配信時の記録であり、ブラウザを含めた成功証明は `integration/develop` statusです。SwiftShaderは機能検証でありPixel Fold等の性能測定ではありません。

## 停止・復旧

- 個別PRの保留理由: Actions summaryおよび `integration-report` artifact。自動化はレビュー解決・label削除・仕様変更を代行しません。
- 全体検証が失敗: 通常の自動mergeを停止。原因修正PRへ `integration:repair` を付けるか、Integration担当が修正をレビューして統合。基盤変更は自動merge条件を満たさなければ担当者が直接PR merge。
- CI成功後のdispatchだけが失敗: 権限エラーを直した後 `Request Integration` を再実行。既存Deploy workflowのRun workflowでbranch **develop** を選ぶ操作でも回復可能。
- 一時的なネットワーク/公開後ブラウザ失敗: 同じDeploy runの全jobを再実行。失敗SHAでは検証・公開・ブラウザを再実施し、古いmanifestだけでsuccessへ変えません。
- 実行が中断されpendingのまま: 同様に全jobを再実行。pendingも通常merge停止として扱います。
- 公開前失敗は公開済みsnapshotを維持。公開後失敗は既に公開済みなので、復旧PRで正常状態へ戻します。自動で未知のrollbackを実行しません。

main/Productionを変更する別作業はこの運用の対象外です。既存main側workflowは変更していません。

公式仕様: [GITHUB_TOKENのイベント抑止とdispatch](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)、[Workflowイベントのdefault branch条件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)。
