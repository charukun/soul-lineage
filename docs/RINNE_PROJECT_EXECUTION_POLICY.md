# 実装セッションの非同期handoffポリシー

Chat / WORK / Codexは一時的な実装環境であり、永続CI監視Workerではない。実装の正本は `charukun/soul-lineage` の最新developとGitHub上のbranch・commit・PRである。

通常の実装セッションは、実装 → 必要最低限の高速検証 → commit → push → PR更新 → Ready for review → Integrationへhandoff → 結果報告・終了までを担当する。

CI / GitHub Actions / Playwright / ブラウザ検証がRunning・Queued・Pendingなら待たずにhandoffする。push直後の短い単発確認で起動や既知の失敗を確認してもよいが、未完了のrun/checkを再取得して完了まで追跡するwatch・sleep/pollingループは禁止する。

Ready後のCI監視、develop統合、DEV公開、browser gate、失敗時のIntegration Rescue・修正Workerへの差し戻し・有限retryはIntegrationの責任とする。「返答がないが裏でCIを追跡している」は正常運用ではなく設計上のアンチパターンであり、CI完了を理由に最終応答を保留しない。

実装成功は `READY_FOR_INTEGRATION`、統合成功は `INTEGRATED`、DEVの公開検証成功は `DEV_DEPLOYED` と区別する。ReadyはCI成功・merge・公開成功を保証しない。通知やhandoffは既存GitHub PR・Integration・Rescue・PULSEの仕組みに統合し、独自Task-IDや別キューを作らない。

main / Productionは通常実装とdevelop Integrationの対象外。明示hold、review、exact-head gate、browser assertion、Rescueのclaim/attempt制限は維持する。

## 短時間確認と失敗の差し戻し

push直後の確認は原則1回、リクエスト単位の短いtimeoutを設ける。workflowの起動・即時失敗・明白な設定誤りだけを確認し、同一headが未完了なら追加確認を予定せず終了する。`gh run watch`、`gh pr checks --watch`、Actions APIを一定間隔で取得する処理、Playwright完了までのセッション保持は禁止する。確認を省略した場合はCI未確認と正直に報告する。

単発確認時に既に失敗していてその場で直せる場合は、同じbranch/PRで最小修正 → 高速検証 → push → Readyへ進めてよい。後から判明した失敗はIntegration / Rescueが失敗run・head SHA・logs/対象テストを根拠に既存Workerへ戻す。修正Workerも再push/Readyで終了する。browser self-healingのclaim/attemptと重複修復防止は [BROWSER_SELF_HEALING.md](BROWSER_SELF_HEALING.md)、Rescueは [INTEGRATION_RESCUE.md](INTEGRATION_RESCUE.md) に従う。

## Readyの終了信号・通知・復旧

GitHubの `open + base=develop + draft=false` がhandoffの境界。受領記録はexact headの `implementation/handoff` statusとPRコメント、監視先は既存Integration / Rescueとする。独自queueや別Task-IDを導入しない。Ready操作の失敗を実装成功とせず、通知送信の失敗を実装失敗やCI成功に置き換えない。

| 工程 | GitHub正本 | 外部通知 |
| --- | --- | --- |
| 作業開始・途中 | work branch / Draft PR / 最新commit | 開始やpush到達。最終成功と混同しない |
| 実装完了 | Ready PR / head / `implementation/handoff`受領 | `READY_FOR_INTEGRATION` |
| develop統合 | merged PR / merge commit / `integration/queue` | `INTEGRATED` |
| DEV完了 | 最終develop SHAの `integration/develop=success` | `DEV_DEPLOYED` |
| 実装失敗 | 同じbranch / commit / Draftまたはhold / 理由 | `FAILED`・到達工程・試した経路・次の復旧経路 |

通知は既存の `NTFY_TOPIC_URL` / `NTFY_TOKEN` を再利用し、送信先を推測しない。未設定・送信失敗はPRコメント/Actionsへ明記し、スマホ到達を確認済みと報告しない。ChatGPTアプリ自身のプッシュ通知や応答表示は完了判定に使わない。

task-startは通常タスクのDraft PR/branch、Dispatchの既存 `.task-start` markerを維持する。Rescueのheartbeat/watchdogはそのlive leaseだけを対象にし、RETURNED/CHECKINGで実装Workerが終了したことをheartbeat途絶と誤認しない。通常Chat/WORK全体を監視する汎用heartbeat daemonは現行Repositoryにないため、あるとは扱わない。新たな永続Workerや独自状態DBは追加しない。

セッション停止時はbranch、commit SHA、PR URL、Ready/Draft、`implementation/handoff`、`integration/queue` / `integration/develop`、exact-head Checks / run / artifact、最新developとの差分から同じPRを再開する。Readyなら監視をIntegrationへ任せ、修正依頼なしにCI待機セッションを再開しない。

## 最終応答の必須項目

実装完了、branch、commit SHA、PR番号/URL、Ready for review化済み、`READY_FOR_INTEGRATION`、CIはIntegrationへhandoff済み、実行した高速検証を返す。CI未確認/実行中と、handoff recorder・通知送信の未確認はそのまま記載する。受領job・通知・CI・ブラウザ完了を待って応答を遅らせない。

## 強制範囲と既存手順

生成Worker指示への共通ルール挿入、Dispatch wrapperのReady後終了、CIのbuild/browserから独立した受領job、通知/受領Checkをcode gateに混ぜない判定、Rescueのslot解放、PULSEの監視担当表示で境界を担保する。テストはCIが永続Runningでも受領が完了し、Draft/旧head/外部PRを誤って受領しないことを確認する。

Repositoryから任意の外部Chat/WORKのツール呼び出しを強制終了することはできない。その範囲はAGENTSの必須参照と最終応答契約で拘束し、機械的強制済みとは主張しない。明示的にIntegration役を担当するタスクには別の責任範囲を適用する。

GitHub経路は通常git → 利用可能なGitHub連携/API → Codespaces＋通常git。一経路の認証/通信/転送制約だけで不能と結論付けない。詳細は [MOBILE_HYBRID_DEVELOPMENT.md](MOBILE_HYBRID_DEVELOPMENT.md)、Draft契約は [DEVELOPMENT.md](DEVELOPMENT.md)、継続監視・公開は [INTEGRATION.md](INTEGRATION.md) を参照する。添付やProject Sourcesの旧 `RINNE_PROJECT_EXECUTION_POLICY` と差がある場合はこのRepositoryの最新版を読む。
