# PULSE

スマホブラウザから、公開環境・PR・Integration・CI/CDの状態を確認するための運用ダッシュボードです。

- GitHub APIと公開deployment metadataを正本として利用
- branch mergeと実deployを分離して表示
- 5分Cron + merge/deploy後の即時同期
- SecretsはWorker側のみで保持し、ブラウザには露出しない
- 一般公開リンクギャラリー `WAYFINDER` の専用Cloudflareデプロイ状態も追跡する
- `WAYFINDER` はPULSEの公開状況に掲載される輪廻転焦Repository内の公開先を案内する導線として扱い、別Repository・別プロジェクト（例: GUILTY'S GARDEN / YARE）を混在させない
- ゲームは公開manifestで確認できた開発・検証・本番URLのみを掲載し、Visual Review Labなどの公開ツールはPULSEでURLが確認できるものだけを掲載する
