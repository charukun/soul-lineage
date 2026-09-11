# 開発WORKとIntegrationの分担

実装の正本は最新develop、運用の正本は現在のRepositoryルールとGitHubの状態です。過去のPR番号や古いhandoffの完了報告を現在の状態とみなしません。

| 担当 | 完了条件 |
| --- | --- |
| 実装WORK | 最新developを基に実装 → 影響範囲の高速検証 → develop向けReady for review PR |
| Integration | 最新Checks・依存・レビュー・競合を判定 → developへ統合 → 最終SHAの影響範囲高速検証 → DEV公開 → 公開HTTP/source確認 |

通常の実装WORKはmerge、全体の重いブラウザ検証、DEV公開待ちを繰り返しません。変更した機能を確かめるための必要な局所テスト・画面確認は省略しません。ユーザーが個別にIntegrationまで依頼した場合は、その担当範囲に従います。

## 実装WORK

1. `AGENTS.md`、最新develop、対象app/packageの仕様を確認。コード変更を伴う通常の実装タスクは、コード修正前に専用branchをpushし、develop向けDraft PRを作成してから実装する。調査・相談・状況確認・文章作成のみのタスクは対象外。
2. `npm ci` と `node scripts/validate.mjs fast origin/develop HEAD`。影響appのcheck/test/build、共有テストは1回。基盤変更時は基盤テストも実施。
3. push前に `npm run push:route -- origin/develop HEAD` を実行。Chat/WORK/Codex実行環境の通常gitを第一候補とし、利用可能なGitHub連携/API、Codespaces＋通常gitの順で切り替える。`CODESPACES_GIT` または容量・Base64・payload上限系エラー時は、同じbranchをGitHub Codespacesで開いて通常`git push`へ即時切り替える。大きなバイナリを連携APIで分割/Base64再送しない。詳細は `docs/MOBILE_HYBRID_DEVELOPMENT.md`。
4. PRへ変更理由・挙動・影響app/package・検証結果・残るリスクを書く。依存があれば `Depends-On: #12, #13`、なければ `Depends-On: none`。
5. 完了したらReady for review。未完了、仕様未決定、取り込み待ちはdraftまたは `integration:hold`。既存Ready PRの保留もこのlabelで制御。
6. 最終報告はPR URLと高速検証結果。最終公開はIntegrationの `integration/develop` statusで区別。

単一appの変更をrootゲーム構成へ戻さず、3ゲームの独立した入口と共有package境界を維持します。通常作業でサブエージェントは使用しません。不要なフルCI、各PRごとのDEV確認、古いLibrary handoffの再作成は不要です。

## 実装WORKからCodespacesへ切り替える場合

Codespacesは「別の開発フロー」ではなくpush経路だけの代替です。最新developを正本とし、作業branch・fast validation・develop向けPR・Integration引き渡しは変更しません。100 MiBを超える単一ファイルは通常Gitへpushせず、Git LFSまたは適切なasset配布方式を選びます。

## Integrationへの引き渡し

自動判定で意味上の仕様矛盾まで証明することはできません。共有契約の変更・意味上の競合はPRに明記し、解消前にReadyへ進めないでください。自動判定できないものは保留し、Integration担当が判断・必要修正・再検証します。

[自動Integrationと復旧](INTEGRATION.md)

通常DEVは高速公開を優先。重い全体回帰・E2E・実ブラウザ検証は必要時の`full_verification=true`へ分離し、Production前の品質基準は維持します。
