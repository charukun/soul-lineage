# 開発中のDEV反映メール通知

この通知はゲーム本体やエンドユーザー向け通知とは分離した、`charukun` 個人専用の開発確認オーバーレイである。将来この開発基盤を他の開発者・組織・地域へ展開しても、このメール機能を共通機能・既定機能・公開設定として提供しない。

DEV Publisher が公開・HTTP/source verificationまで成功したとき、**前回通知済みの公開develop SHAから今回の公開SHAまでに新たに含まれたdevelop向けmerged PRをすべて列挙し、PRごとに通知する**。latest-only publisherが複数mergeを1回の公開へcoalesceした場合も、中間PRの通知を落とさない。通知対象は `charukun/soul-lineage` かつ PR作者が `charukun` の場合だけとし、それ以外のPR・fork・将来利用者では個人メール通知処理を実行しない。共通Integration / DEV deliveryの状態通知は、この個人オーバーレイから独立した中立な契約を維持する。

個人向け通知本文は日本語で、内部ステータス・SHA・Actions Run・英語の診断文を表に出さない。修正内容はPR本文の先頭1行を優先し、空の場合だけPRタイトルへfallbackする。表示は次の程度に留める。

```text
DEV反映完了
「<修正内容>」をDEVに反映しました。
DEVを確認: https://charukun.github.io/soul-lineage/dev/
```

通知先はGitHubの既存PR購読メールを利用する。ゲーム側のpush/ntfy、独自SMTP、外部メール配信サービス、新規Task-IDや通知queueは使わない。**PRごとにそのPRのmerge commit SHAをreceipt markerへ使い**、同じ変更の重複コメントを防ぐ。公開SHA単位ではなくPR単位でdedupeするため、複数PRをcoalesceした公開でも各PRへ1回だけ通知できる。GitHubメールの件名はPRスレッド由来であり、この個人オーバーレイの公開API契約には含めない。

このコメントはPR Conversationへの書き込みなので、DEV Publisherの最終結果jobには `pull-requests: write` を明示する。`pull-requests: read` のままでは `POST /issues/{pr}/comments` が403になり、DEV公開成功でもメール通知だけ欠落するため、権限契約テストで固定する。

公開差分に対象PRがないpublish-only実行、PR作者が `charukun` でない場合、対象Repositoryでない場合はそのPRの個人メール通知を作成しない。通知範囲の基準SHAは、既存の verified DEV Last Known Good artifact (`dev-lkg-site-<SHA>`) から直前の公開SHAを解決する。基準が見つからない初回・復旧実行では、今回SHAに直接対応するmerged PRだけへ通知し、無制限な履歴走査を行わない。GitHubのDEV delivery statusは通知結果と独立して残す。

このメール通知はadvisoryであり、Integration gate、DEV公開成否、browser repair、main / Production品質判定を変更しない。
