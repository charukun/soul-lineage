# PULSE

PULSEの仕様正本は `docs/OPS_BOARD.md` です。

実装は `ops-board/`、管理対象の単一カタログは `scripts/application-catalog.mjs` の `PULSE_SURFACES`、DEV公開は既存の `.github/workflows/dev-app-publish.yml` を使用します。

重要な実装原則は3点だけです。

- DEVはGitHub commit status `dev/<app>` を正本とし、Pages DEVを参照しない。
- PULSE同期障害でアプリ一覧や既知URLを消さない。未確認は `unknown`。
- snapshot / cache / historyは補助情報であり、Durable Objects永続書き込みをPULSE正常性の前提にしない。

状態意味やUI受入条件をこのREADMEへ重複定義しないでください。
