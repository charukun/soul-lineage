# Documentation map

このディレクトリの入口。資料の量を増やして正本を増やさないため、まずここで「何が現在の規則か」を判定する。

## 正本の優先順位

1. 最新 `develop` と現在の GitHub 状態（branch / commit / PR / Checks / status）
2. `AGENTS.md` のルーティング
3. 下記の canonical documents
4. 対象領域の専門資料
5. Git / PR / Actions の履歴

下位資料が上位の現在状態と矛盾する場合、下位資料の古い状態説明を現在の規則として使わない。過去の PR 番号・SHA・日時・一時 branch は GitHub 履歴を証跡として参照する。

## Canonical documents

| 目的 | 正本 |
| --- | --- |
| コンテキスト取得量・読み方 | [`CONTEXT_EFFICIENCY.md`](CONTEXT_EFFICIENCY.md) |
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
  -> work branch / Draft PR
  -> implementation
  -> fast validation
  -> push / Ready
  -> READY_FOR_INTEGRATION
  -> Integration Fast Lane
  -> develop
  -> asynchronous DEV publication / browser repair
```

実装 WORK は Ready / `READY_FOR_INTEGRATION` で終了し、CI・browser・DEV 公開を待って polling しない。main / Production は明示許可時のみ変更する。品質 gate を弱めない。

## 互換入口と履歴

同じ規則を別ファイルへ複製しない。短い互換入口は canonical document へリンクし、詳細規則は1箇所だけに置く。

- `INTEGRATION_FAST_LANE.md`: `INTEGRATION.md` への短い互換入口。
- `INTEGRATION_AUTONOMOUS_DELIVERY_V4.md`: 旧 control-plane 設計を指す短い履歴ポインタ。現在の merge authority ではない。
- 時点付きの統合結果、旧 Rescue の受入・手動排出・throughput・Work復旧記録は repository の現行資料から外し、Git / PR / Actions history を証跡とする。

## 削除してよいもの

履歴という理由だけで無期限に残さない。次をすべて満たす資料・コードは削除候補とする。

- current workflow / source / test / canonical document から参照されていない。
- 現行機能の fallback・migration・compatibility path ではない。
- 実装判断に必要な唯一の証跡ではなく、Git / PR / Actions history で追跡できる。
- 削除しても test、browser assertion、review、Integration、Production gate を弱めない。

判断が曖昧なものは残し、参照関係を先に確認する。generated artifact、temporary marker、過去の一時受入レポートは、上記条件を満たせば履歴を Git に任せて repository から除去する。

## 更新ルール

- 新しい横断ルールを追加する前に、既存 canonical document のどこへ入れるかを決める。
- 同じルールを AGENTS / README / DEVELOPMENT / Integration 文書へ重複記載しない。
- 入口文書は「どこを読むか」、canonical document は「何を守るか」に役割を分ける。
- 現行経路を置き換えた場合、外部参照互換が必要なら短いポインタだけ残す。不要な時点付き報告や旧実装は Git 履歴へ任せて削除する。
