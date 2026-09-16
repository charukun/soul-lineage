# 開発中のDEV反映メール通知

この通知はゲーム本体やエンドユーザー向け通知とは分離した、`charukun` 個人専用の開発確認オーバーレイである。将来この開発基盤を他の開発者・組織・地域へ展開しても、このメール機能を共通機能・既定機能・公開設定として提供しない。

DEV Publisher が公開・HTTP/source・focused browser verificationまで成功したとき、公開develop SHAに対応するdevelop向けPRを特定する。通知対象は `charukun/soul-lineage` かつ PR作者が `charukun` の場合だけとし、それ以外のPR・fork・将来利用者では個人メール通知処理を実行しない。共通Integration / DEV deliveryの状態通知は、この個人オーバーレイから独立した中立な契約を維持する。

個人向け通知本文は日本語で、内部ステータス・SHA・Actions Run・英語の診断文を表に出さない。修正内容はPR本文の先頭1行を優先し、空の場合だけPRタイトルへfallbackする。表示は次の程度に留める。

```text
DEV反映完了
「<修正内容>」をDEVに反映しました。
DEVを確認: https://charukun.github.io/soul-lineage/dev/
```

通知先はGitHubの既存PR購読メールを利用する。ゲーム側のpush/ntfy、独自SMTP、外部メール配信サービス、新規Task-IDや通知queueは使わない。GitHub側で同一SHAのreceipt markerを使い重複コメントを防ぐ。GitHubメールの件名はPRスレッド由来であり、この個人オーバーレイの公開API契約には含めない。

このコメントはPR Conversationへの書き込みなので、DEV Publisherの最終結果jobには `pull-requests: write` を明示する。`pull-requests: read` のままでは `POST /issues/{pr}/comments` が403になり、DEV公開成功でもメール通知だけ欠落するため、権限契約テストで固定する。

PRを特定できないpublish-only実行、PR作者が `charukun` でない場合、対象Repositoryでない場合は個人メール通知を作成しない。GitHubのDEV delivery statusだけを残す。

このメール通知はadvisoryであり、Integration gate、DEV公開成否、browser repair、main / Production品質判定を変更しない。
