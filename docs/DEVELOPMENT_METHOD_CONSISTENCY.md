# 開発手法整合性修復

2026-09-14時点の最新Repository状態を正本として、開発手法の実装・運用・観測に残っていた不整合を一括修復した記録です。

## 実施結果

### RINNE Dispatch

- GitHub Actionsから `openai/codex-action` / `OPENAI_API_KEY` を除去した。
- `RINNE Dispatch Handoff` はeligible Draft PRの検証と `dispatch/handoff` 記録だけを行う。
- 実装は設定済みChatGPT WorkのGitHub PR-openイベントタスクが同じbranch/PRで担当し、push → Ready → `READY_FOR_INTEGRATION` で終了する。
- 有料Platform APIへの自動fallbackは行わない。
- 旧移行PR #130は本PRへ吸収し、重複Integrationを避けるためcloseした。

### Code Health

- default branchが`main`なのにdevelopだけの`schedule`へ依存していた独立 `.github/workflows/code-health.yml` を廃止した。
- `integration-rescue.yml` のtrusted develop control planeへ `Code Health maintenance` jobを内蔵した。
- 各Integration/Rescueサイクル後に軽量監査し、actionable hotspotがあれば既存RINNE Dispatch Draftを最大1件だけ作る。
- 自動refactorは同時1件、かつ前回作成から72時間のcooldownを置く。
- token未設定時は監査成功を維持し、自動PR作成だけを明示skipする。

### Integration Rescue

- workflowの暗黙V2既定6を撤去し、文書・PULSE fixtureと同じ `MAX_RESCUE_CONCURRENCY` 既定4へ戻した。
- attempt、claim、heartbeat、RED lock、通常Integrationへの復帰条件は変更していない。

### PULSE publication

- 公開直後に `api/version` は新revision、`api/refresh` は旧Worker revisionを返すedge伝播raceを再現根拠として修復した。
- 異なる有効な40桁SHAだけを一時的な旧revision候補として最大60秒のbounded retry対象にした。
- 期待SHAと一致しないまま期限を超えれば従来どおりfailure。
- SHA欠落・不正revisionは即failする。exact-source assertionは弱めていない。
- PULSE focused workflowは修復途中head `620a830e268eb57064d55ebcd5a2ffd0d131a97a` でsuccessを確認した。

### 実行ポリシー / Project Source

- `docs/RINNE_PROJECT_EXECUTION_POLICY.md` に `Policy-Version: 2026-09-14-async-handoff-v2` を追加した。
- Repository版を正本と明示し、Project Sources・添付・過去Chatに旧版が残る場合もRepository最新版を優先する。
- 旧 `SUCCESS` 一括表現、通常Chat/WORK全体へ常駐heartbeat daemonがある前提、CI/browser同期待機を退役対象として明記した。
- 現行の `READY_FOR_INTEGRATION` → `INTEGRATED` → `DEV_DEPLOYED` を維持した。

### Repository governance

- `develop` / `main` の実GitHub branch metadataを読む `scripts/repository-governance-audit.mjs` を追加した。
- PULSEのtrusted公開経路から定期的に監査し、各branch headへ `governance/branch-protection` statusを記録する。
- `protected:false` や取得不能を安全扱いしない。
- 監査statusは保護そのものではない。GitHub Administration設定が必要な外部不足はIssue #211へ記録した。
- 現在の接続済みGitHub経路にはAdministration write操作が公開されていないため、branch protectionを「適用済み」と偽装しない。

## 検証

- branchは最新develop `cfd31ecff9fa4ebc3719fdd0c9f6c573667d072c` から作成し、最終確認時 `behind=0`。
- Draft CI exact-head確認は成功。
- PULSE public environment auditはsuccess。
- PULSE focused workflowはPULSE race修復・governance testを含むheadでsuccess。
- 独立Code Health workflow化の途中でGitHub workflow validation failureを検知し、その構造は破棄した。最終構成は既存 `integration-rescue.yml` 内の通常jobで、失敗した独立workflow file自体を削除済み。
- Dispatcher、PULSE revision retry、governance、開発手法契約の回帰テストを追加した。
- Ready後のfull exact-head fast/browser gate、trusted control review、develop統合、DEV公開は通常Integrationへ非同期handoffする。

## 外部設定として残るもの

GitHub側の `develop` / `main` branch protection / rulesetだけはRepositoryコードでは適用できず、Administration権限を持つ経路が必要。Issue #211を復旧座標とし、実際に両branchが `protected:true` になり監査statusがsuccessになるまで未完了の外部governance設定として扱う。

この制約を除き、本PRで修復可能な開発手法不整合は同一branch/PRへ集約済み。main / Productionのsourceは変更していない。
