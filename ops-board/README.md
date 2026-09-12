# Rinne Ops Board

スマホブラウザから、公開環境・PR・Integration・CI/CDの状態を確認するための運用ダッシュボードです。

- GitHub APIと公開deployment metadataを正本として利用
- branch mergeと実deployを分離して表示
- 5分Cron + merge/deploy後の即時同期
- SecretsはWorker側のみで保持し、ブラウザには露出しない
- 一般公開リンクギャラリー `WAYFINDER` の専用Cloudflareデプロイ状態も追跡する
