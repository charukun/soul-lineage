# 実装セッションの非同期handoffポリシー

Chat / WORK / Codexは一時的な実装環境であり、永続CI監視Workerではない。実装の正本は `charukun/soul-lineage` の最新developとGitHub上のbranch・commit・PRである。

通常の実装セッションは、実装 → 必要最低限の高速検証 → commit → push → PR更新 → Ready for review → Integrationへhandoff → 結果報告・終了までを担当する。

CI / GitHub Actions / Playwright / ブラウザ検証がRunning・Queued・Pendingなら待たずにhandoffする。push直後の短い単発確認で起動や既知の失敗を確認してもよいが、未完了のrun/checkを再取得して完了まで追跡するwatch・sleep/pollingループは禁止する。

Ready後のCI監視、develop統合、DEV公開、browser gate、失敗時のIntegration Rescue・修正Workerへの差し戻し・有限retryはIntegrationの責任とする。「返答がないが裏でCIを追跡している」は正常運用ではなく設計上のアンチパターンであり、CI完了を理由に最終応答を保留しない。

実装成功は `READY_FOR_INTEGRATION`、統合成功は `INTEGRATED`、DEVの公開検証成功は `DEV_DEPLOYED` と区別する。ReadyはCI成功・merge・公開成功を保証しない。通知やhandoffは既存GitHub PR・Integration・Rescue・PULSEの仕組みに統合し、独自Task-IDや別キューを作らない。

main / Productionは通常実装とdevelop Integrationの対象外。明示hold、review、exact-head gate、browser assertion、Rescueのclaim/attempt制限は維持する。
