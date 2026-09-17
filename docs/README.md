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
| Astra の worker outcome / 状態境界 | [`ASTRA_OUTCOME_CONTRACT.md`](ASTRA_OUTCOME_CONTRACT.md) |
| 通常の実装 WORK | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| 実装終了・非同期待機・通知境界 | [`RINNE_PROJECT_EXECUTION_POLICY.md`](RINNE_PROJECT_EXECUTION_POLICY.md) |
| develop Integration / Fast Lane / DEV 公開 | [`INTEGRATION.md`](INTEGRATION.md) |
| Fast Repair / 旧 Rescue 互換 | [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md) |
| Integration control-plane の再調停 | [`INTEGRATION_RECONCILIATION.md`](INTEGRATION_RECONCILIATION.md) |
| browser repair | [`BROWSER_SELF_HEALING.md`](BROWSER_SELF_HEALING.md) |
| 実ブラウザ操作依頼の経路 | [`BROWSER_PLAYTEST_ROUTING.md`](BROWSER_PLAYTEST_ROUTING.md) |
| GitHub / Codespaces の搬送経路 | [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md) |
| 転送・push の既存承認 | [`DELIVERY_AUTHORIZATION.md`](DELIVERY_AUTHORIZATION.md) |
| monorepo / CI/CD 構造 | [`MONOREPO.md`](MONOREPO.md) |
| gameplay / platform 境界 | [`PLATFORMS.md`](PLATFORMS.md) |
| 構造的負債 | [`CODE_HEALTH.md`](CODE_HEALTH.md) |
| RINNE Dispatch | [`DISPATCHER.md`](DISPATCHER.md) |

キャラクター・DCC・モーションは [`art/README.md`](art/README.md) と `characters/` 配下、ゲーム固有仕様は `rinne/` / `demon/` 等の対象資料を読む。全 docs を一括取得しない。

## 現行開発フロー

```text
latest develop
  -> AGENTS.md
  -> context:plan（checkout がある場合）
  -> task-specific docs only
  -> short-lived work branch
  -> WORKING: Astra owns implementation / semantic reconciliation / validation choice
  -> READY: final reconciled exact head + sufficient evidence + pushed source
  -> READY_FOR_INTEGRATION
  -> deterministic Integration / exact-head / CAS
  -> develop
  -> asynchronous DEV publication
```

`BLOCKED` は repository contract と user intent だけでは安全に解けない product / permission / external-input choice に限定する。Draft は長時間作業や途中共有を GitHub 上で可視化したい場合だけ使う optional transport であり、短寿命タスクの必須工程ではない。worker-facing routeを変更行数や固定分類で分岐せず、変更 risk から必要 evidence を直接選ぶ。

実装 WORK は Ready / `READY_FOR_INTEGRATION` で終了し、CI・browser・DEV 公開を待って polling しない。main / Production は明示許可時のみ変更する。品質 gate を弱めない。

## 重複資料の扱い

同じ規則を別ファイルへ複製しない。短い入口文書は canonical document へリンクし、詳細規則は1箇所だけに置く。

次は current policy ではなく補助資料として扱う。

- `INTEGRATION_AUTONOMOUS_DELIVERY_V4.md`: 過去の control-plane 設計記録。現在の merge authority ではない。
- `INTEGRATION_RESULTS.md`, `INTEGRATION_DELIVERY_RECOVERY_145.md`, `INTEGRATION_QUEUE_RECOVERY.md`: 時点付き結果・復旧記録。
- `INTEGRATION_RESCUE_EVIDENCE.md`, `INTEGRATION_RESCUE_LIVE_ACCEPTANCE.md`, `INTEGRATION_RESCUE_MANUAL_DRAIN.md`, `INTEGRATION_RESCUE_THROUGHPUT.md`, `INTEGRATION_RESCUE_WORK.md`: Rescue 世代の証跡・運用履歴・互換情報。現在の通常 merge 経路は `INTEGRATION.md`、Repair の現在形は `INTEGRATION_RESCUE.md` を優先する。

履歴資料は当時の事実を保存するため、古い SHA や状態を機械的に現在値へ書き換えない。一方、別の正本へ転送するだけのshimや、置換後に一意な履歴・証拠を持たないroute文書は残さない。Git履歴で追えるため、現行workerを古い経路へ誘導する互換入口を常設しない。

## 更新ルール

- 新しい横断ルールを追加する前に、既存 canonical document のどこへ入れるかを決める。
- 同じルールを AGENTS / README / DEVELOPMENT / Integration 文書へ重複記載しない。
- 入口文書は「どこを読むか」、canonical document は「何を守るか」、履歴資料は「何が起きたか」に役割を分ける。
- 現行経路を置き換えた場合、固有の歴史的証拠がある資料は historical と明示して残し、単なる互換shimや重複routeは削除する。
