# 開発中のDEV反映メール通知

この通知はゲーム本体やエンドユーザー向け通知とは分離した、開発者向けの確認連絡である。

DEV Publisher が公開・HTTP/source・focused browser verificationまで成功したとき、公開develop SHAに対応するdevelop向けPRを特定し、そのPRへGitHub Actions botが `DEV反映完了` コメントを1件記録する。PRタイトルを修正内容として本文へ含め、DEV確認URLを付ける。

通知先はGitHubの既存PR購読メールを利用する。ゲーム側のpush/ntfy、独自SMTP、外部メール配信サービス、新規Task-IDや通知queueは使わない。GitHub側で同一SHAのreceipt markerを使い重複コメントを防ぐ。

PRを特定できないpublish-only実行では、誤った修正内容をメールしない。GitHubのDEV delivery statusだけを残す。

このメール通知はadvisoryであり、Integration gate、DEV公開成否、browser repair、main / Production品質判定を変更しない。
