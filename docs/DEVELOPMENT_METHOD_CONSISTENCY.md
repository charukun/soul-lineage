# 開発手法整合性修復

この文書は、2026-09-14時点のRepository状態を基準に、開発手法の実装・運用・観測の不整合を一括で解消するための受入条件を記録する。

## 対象

- RINNE Dispatchを追加Platform API課金なしのChatGPT Work handoffへ統一する。
- Code Healthの定期実行をdefault branch依存のscheduleから、develop上の既存Integration経路へ移す。
- Integration Rescueの既定並列数と文書を一致させる。
- PULSE公開直後に旧Worker revisionへ当たる伝播raceを有限retryで吸収し、exact SHA検証自体は弱めない。
- Repository版 `RINNE_PROJECT_EXECUTION_POLICY.md` をProject Sourceへ同期できる形で自己完結させ、旧SUCCESS/汎用heartbeat前提を明示的に退役させる。
- develop/mainの保護状態を機械監査し、Repository外のGitHub設定が不足している場合に黙って安全扱いしない。

## 受入条件

1. GitHub Actions上のDispatcherは `openai/codex-action` / `OPENAI_API_KEY` を使用せず、eligible Draft PRのhandoff記録だけを行う。
2. Code Healthはdefault branchがmainでもdevelop Integrationから実行でき、同時に自動refactor Draftを1件までに制限する。
3. Rescueの有効な既定値はworkflow・docs・PULSE説明で同一になる。
4. PULSEは旧Worker revisionを一時的に返した場合だけ有限retryし、異なるSHAを成功扱いしない。
5. 通常実装の成功名は `READY_FOR_INTEGRATION`、統合は `INTEGRATED`、DEV公開は `DEV_DEPLOYED` のまま維持する。
6. branch protection / rulesetが未設定なら監査結果をfail-closedで可視化する。保護設定そのものはGitHub administration権限で適用し、コード側で保護済みと偽装しない。
7. main / Productionはこの修復PRから変更しない。
