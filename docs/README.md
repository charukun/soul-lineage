# Documentation map

このディレクトリの入口。資料の量を増やして正本を増やさないため、まずここで「何が現在の規則か」を判定する。

## 正本の優先順位

1. 最新 `develop` と現在の GitHub 状態（branch / commit / PR / Checks / status）
2. `AGENTS.md` のルーティング
3. 下記の canonical documents
4. 対象領域の専門資料
5. 履歴・受入記録・旧設計資料

下位資料が上位の現在状態と矛盾する場合、下位資料の古い状態説明を現在の規則として使わない。過去の PR 番号・SHA・日時・一時 branch は、その資料が明示的に履歴を扱う場合だけ証跡として参照する。

## Canonical documents

| 目的 | 正本 |
| --- | --- |
| コンテキスト取得量・読み方 | [`CONTEXT_EFFICIENCY.md`](CONTEXT_EFFICIENCY.md) |
| 通常の実装 WORK | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| 実装終了・非同期待機・通知境界 | [`RINNE_PROJECT_EXECUTION_POLICY.md`](RINNE_PROJECT_EXECUTION_POLICY.md) |
| develop merge lane / DEV 公開 | [`DEVELOP_MERGE.md`](DEVELOP_MERGE.md) |
| Fast Repair / 旧 Rescue 互換 | [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md) |
| legacy merge-control の再調停 | [`INTEGRATION_RECONCILIATION.md`](INTEGRATION_RECONCILIATION.md) |
| browser repair | [`BROWSER_SELF_HEALING.md`](BROWSER_SELF_HEALING.md) |
| 実ブラウザ操作依頼の経路 | [`BROWSER_PLAYTEST_ROUTING.md`](BROWSER_PLAYTEST_ROUTING.md) |
| GitHub / Codespaces の搬送経路 | [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md) |
| 転送・push の既存承認 | [`DELIVERY_AUTHORIZATION.md`](DELIVERY_AUTHORIZATION.md) |
| monorepo / CI/CD 構造 | [`MONOREPO.md`](MONOREPO.md) |
| gameplay / platform 境界 | [`PLATFORMS.md`](PLATFORMS.md) |
| per-app / per-target build・artifact・配信 | [`DISTRIBUTION_ARCHITECTURE.md`](DISTRIBUTION_ARCHITECTURE.md) |
| 構造的負債 | [`CODE_HEALTH.md`](CODE_HEALTH.md) |
| RINNE Dispatch | [`DISPATCHER.md`](DISPATCHER.md) |

キャラクター・DCC・モーションは [`art/README.md`](art/README.md) と `characters/` 配下、ゲーム固有仕様は `rinne/` / `demon/` 等の対象資料を読む。全 docs を一括取得しない。

## 現行開発フロー

```text
latest develop
  -> AGENTS.md
  -> context:plan（checkout がある場合）
  -> task-specific docs only
  -> work branch / Draft PR
  -> implementation
  -> fast validation
  -> push / Ready
  -> focused validation + freshness verify
  -> same-task PR merge
  -> develop
  -> asynchronous DEV publication / browser repair
```

実装 WORK はfocused validationとfreshness verify後に同じPRを`develop`へmergeして終了する。DEV公開を待ってpollingしない。main / Production は明示許可時のみ変更する。品質 gate を弱めない。

## 重複資料の扱い

同じ規則を別ファイルへ複製しない。短い入口文書は canonical document へリンクし、詳細規則は1箇所だけに置く。

次は current policy ではなく補助資料として扱う。

- `INTEGRATION_FAST_LANE.md`: 旧名称の互換入口。現行正本は `DEVELOP_MERGE.md`。
- `INTEGRATION_AUTONOMOUS_DELIVERY_V4.md`: 過去の control-plane 設計記録。現在の merge authority ではない。
- `INTEGRATION_RESULTS.md`, `INTEGRATION_DELIVERY_RECOVERY_145.md`, `INTEGRATION_QUEUE_RECOVERY.md`: 時点付き結果・復旧記録。
- `INTEGRATION_RESCUE_EVIDENCE.md`, `INTEGRATION_RESCUE_LIVE_ACCEPTANCE.md`, `INTEGRATION_RESCUE_MANUAL_DRAIN.md`, `INTEGRATION_RESCUE_THROUGHPUT.md`, `INTEGRATION_RESCUE_WORK.md`: Rescue 世代の証跡・運用履歴・互換情報。現在の通常 merge 経路は `DEVELOP_MERGE.md`、Repair の現在形は `INTEGRATION_RESCUE.md` を優先する。

履歴資料は当時の事実を保存するため、古い SHA や状態を機械的に現在値へ書き換えない。現行規則が必要な箇所からは canonical document だけを参照する。

## 更新ルール

- 新しい横断ルールを追加する前に、既存 canonical document のどこへ入れるかを決める。
- 同じルールを AGENTS / README / DEVELOPMENT / merge文書へ重複記載しない。
- 入口文書は「どこを読むか」、canonical document は「何を守るか」、履歴資料は「何が起きたか」に役割を分ける。
- 現行経路を置き換えた場合は、旧資料を削除して証跡を失うより、明確に historical / compatibility と表示して canonical へのリンクを残す。
