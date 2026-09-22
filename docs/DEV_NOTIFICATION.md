# 開発中のDEV反映メール通知

この通知はゲーム本体やエンドユーザー向け通知とは分離した、`charukun` 個人専用の開発確認オーバーレイである。将来この開発基盤を他の開発者・組織・地域へ展開しても、このメール機能を共通機能・既定機能・公開設定として提供しない。

DEV Publisher が公開・HTTP/source verificationまで成功したとき、その公開に初めて含まれたdevelop向けPRを特定する。直前のverified DEV Last Known Good artifactから前回公開SHAを解決できる場合は、前回公開SHAから今回公開SHAまでをbounded compareし、その範囲でdevelopへmergeされたPRをすべて対象にする。連続mergeがlatest-only DEV Publisherへcoalesceされた場合でも、対象PRごとの通知を取りこぼさない。

直前公開SHAを解決できない初回・復旧時は、今回公開SHAに直接関連付いたdevelop向けPRへfallbackする。range lookupが失敗した場合も同じexact published SHA fallbackに切り替え、通知障害をDEV公開成否へ伝播させない。無制限の履歴走査は行わない。

通知対象は `charukun/soul-lineage` かつ PR作者が `charukun` の場合だけとし、それ以外のPR・fork・将来利用者では個人メール通知処理を実行しない。共通DEV deliveryの状態通知は、この個人オーバーレイから独立した中立な契約を維持する。

個人向け通知本文は日本語で、内部ステータス・SHA・Actions Run・英語の診断文を表に出さない。修正内容はPR本文の先頭1行を優先し、空の場合だけPRタイトルへfallbackする。表示は次の程度に留める。

```text
DEV反映完了
「<修正内容>」をDEVに反映しました。
DEVを確認: https://charukun.github.io/soul-lineage/dev/
```

通知先はGitHubの既存PR購読メールを利用する。**開発者向け通知でゲームプレイヤー用のpush / ntfyを絶対に使わない。** develop publication、Ready / handoff、PULSE control-plane、Repair / Rescue のいずれも `NTFY_TOPIC_URL` / `NTFY_TOKEN` を開発者通知のために参照しない。独自SMTP、外部メール配信サービス、新規Task-IDや通知queueも追加しない。GitHub側では各PRのmerge commit SHAをreceipt markerに使い、同じPRのretry/recoveryで重複コメントを作らない。同じ公開SHAに複数PRが含まれる場合も、それぞれ別のmerge commit markerで1回ずつ通知する。GitHubメールの件名はPRスレッド由来であり、この個人オーバーレイの公開API契約には含めない。

通常のDEV PublisherはPR Conversationへreceiptを書き込む。高速DEVの通知jobはFast DEV契約上workflow権限を拡張しないため、PRコメントが403で拒否された場合は個人専用Issue #1009「DEV反映通知」へ同じreceiptをfallback投稿する。どちらも `@charukun` mentionとmerge commit markerを使い、同じ反映の重複メールを防ぐ。

PRを特定できないpublish-only実行、PR作者が `charukun` でない場合、対象Repositoryでない場合は個人メール通知を作成しない。GitHubのDEV delivery statusだけを残す。receipt生成成否はGitHub statusで観測可能にするが、通知はadvisoryでありDEV公開成否を失敗へ変えない。

このメール通知はadvisoryであり、DEV公開成否、browser repair、main / Production品質判定を変更しない。


## 端末通知の境界

Repository が保証するのは、verified DEV publication 後に対象PRへ `DEV反映完了` receiptを作成し、GitHub購読メールの生成を起こすところまで。Gmailがそのメールを `メイン` / `更新` のどちらへ分類するか、Android版Gmailが端末通知を表示するかはGmail側のフィルタ・カテゴリ・ラベル通知設定であり、ゲームプレイヤー用pushへ迂回して補完しない。
