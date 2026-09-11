# Integration結果の確認

正本: [Integrationの条件と復旧](INTEGRATION.md)。

| 表示 | 意味 |
| --- | --- |
| PRのValidate and build成功 | そのheadの必要な高速検証が成功 |
| Request Integration成功 | develop指定の統合実行を要求済み |
| Actions summaryのMerged | このバッチで統合したPR |
| Actions summaryのHeld | 保留PRと現在の理由 |
| developのintegration/develop成功 | 最終SHAの全体回帰・DEV公開HTTP・実Chromium/WebGL2確認が成功 |

appが変更されなければ公開version.jsonのcommitは元のbuild SHAを保持します。最終developとの整合はinputHashで確認し、全体の成功はintegration/developを確認します。

一時的な配信/通信失敗は既存Deploy実行の全jobを再実行します。Run workflowから起動する場合はbranchをdevelopにしてください。継続的な失敗は原因修正PRで対応し、Checksや保護ルールを外して成功扱いにしません。
