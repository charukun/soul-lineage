# Integration Rescue Work route — RETIRED

この文書が定義していた ChatGPT Work による定期push/watchdog/FAILED_MANUAL修復経路は退役済みです。**新しいWorkタスクを作成・再有効化・fallbackとして起動しないでください。**

現在の正本は次のとおりです。

1. 機械的に安全な復旧は GitHub Actions の Fast Repair / Fast Lane が処理する。
2. current exact-head に意味的な競合またはsource-level CI修復が必要な場合、Repositoryは `integration-deep-repair:v1` + `chat-repair:v1` のGitHub Issueを1件だけ作成する。
3. IssueはownerへGitHub通知を出し、通常Chatへ貼り付ける復旧プロンプトを含む。GitHub通知メールの配送はownerのGitHub通知設定に従う。
4. ユーザーが通知を見て通常Chatを手動開始した場合だけ、Chatが現在のGitHub状態を再取得して双方の意図を調停し、同じPR branchを修復する。
5. ChatGPT Work、Codex、OpenAI API、追加の有料モデルAPI、専用PATをIntegration復旧のfallbackに使わない。
6. true product/schema/save/protocol decisionが現在の確定契約から解けない場合だけ `human-required` として停止する。

旧 `integration-rescue-work-*` scripts/state は既存stateの互換・診断・履歴読取りのため残る場合がありますが、**現在の自動復旧を起動する権限や経路ではありません**。旧stateの `AWAITING_PUSH`、Work claim、heartbeat、Work attemptを見つけても、それを理由にWorkを再開しません。

詳細は [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md) と [`INTEGRATION_DEEP_REPAIR.md`](INTEGRATION_DEEP_REPAIR.md) を参照してください。
