# Integration Control Plane v2

## 目的

開発PRが増え続けても、Integration / Rescue / PULSE の改善そのものが無関係なゲーム側browser failureや重複Actions runへ巻き込まれて永久に後回しにならない制御面を維持する。

## 登録済み入口と責任分離

Repositoryのdefault branchは `main` であり、developだけに新設したworkflowをRESTで直接dispatchする前提は置かない。

- `.github/workflows/deploy.yml`
  - default branchにも存在する登録済みgateway。
  - `workflow_dispatch` の通常wakeは重複をcoalesceし、develop上のreusable `integration-controller.yml` を呼ぶ。
  - develop / mainへのpushではPublisherとして動作する。
  - developではPages公開、公開source照合、focused browser、DEV結果、PULSE、通知health、Canaryを担当する。
  - main / Productionの既存公開経路は維持する。
- `.github/workflows/integration-controller.yml`
  - `workflow_call` 専用。
  - Ready PRの評価、exact-head safety gate、develop merge、Integration Rescue、Queue Recovery、bounded continuationを担当する。
  - Pages公開を行わない。

これにより、Integration評価とPages/browser公開の責任を分離しつつ、default branchを変更せず既存dispatch入口を維持する。

## Wakeup coalescing

`deploy.yml` のworkflow_dispatch runは、同じdevelopにactiveなgateway runが複数ある場合、最小run IDをownerとして1本だけControllerを実行する。その他は `integration/wakeup=pending` へ「coalesced」と記録して終了する。

Publisherが動作中なら新しいReady wakeはPublisherの後ろへcoalesceする。DEV成功時に1回 `rescue_mode=scan` を起動するため、Readyイベントは失われない。独立watchdogもdurable fallbackとして残す。

## Trusted control-plane Fast Lane

Controller開始時にReady PRの全changed-filesを取得し、`scripts/integration-control-plane.mjs` で分類する。

全ファイルが次の制御面に限定される場合だけ `integration:control-plane` / `integration:repair` を自動付与できる。

- `.github/workflows/**`
- Integration / Rescue / browser repair / notification / deploy制御script
- `ops-board/**`
- 対応するtests
- Integration / DEVELOPMENT / execution policy / browser self-healing / Ops docs
- `AGENTS.md`, PR template, `.task-start/**`

`apps/**`, `packages/**`, `portal/**` など製品・共有runtimeが1ファイルでも混ざればFast Lane不可。hold、Changes requested、unresolved thread、dependency、mergeability、exact-head CI/browser、trusted reviewは従来どおり必須であり、Fast Laneは品質gateを弱めない。

## Repair generation retirement

新しいdevelop browser結果を記録するとき、旧develop SHAが現在SHAのexact ancestorで、ticketが `working` でない場合だけ旧generationを自動retireする。

- descendant success: `verified` としてclose
- descendant failure: `superseded` としてclose
- working ticket: ownershipを奪わない

これにより古いAUTO-REPAIR issueがPULSEへ残り続けることを防ぐ。

## Pages artifact dedupe

Publisherは `_site` を作成した後、4KiB以上の同一byte / 同一modeファイルをSHA-256で照合し、同一filesystem上のhardlinkへ置換してからPages artifactを作る。

- 公開pathは変更しない。
- byte内容を変更しない。
- hash/source verificationを省略しない。
- 異なる内容は同サイズでもdedupeしない。

`site-dedupe.json` をpublication diagnosticsへ保持する。

## Control-plane Canary

DEV成功後、PULSE公開が成功している場合に次をexact develop SHAで確認する。

- public deployment manifestの `validatedDevelop`
- PULSE `/api/state` が取得可能
- `integration/develop=success`
- `ops-board/public=success`
- `notification/ntfy=success`

結果を `integration/canary` statusへ記録する。Canaryはdeliveryの成功を捏造せず、通知未設定を含む制御面driftを可視化する。

## Notification health

INTEGRATED / DEV_DEPLOYED通知後、同じdevelop SHAへ `notification/ntfy` statusを記録する。

- `success`: ntfy到達確認
- `error`: NTFY未設定、スマホ到達未確認
- `failure`: ntfy送信失敗

通知失敗はGitHub上のmerge/DEV事実を巻き戻さない。

## PULSE metrics

PULSEは既存Integration表示内に次を追加する。

- 最古Ready待ち時間
- Ready待ち p50 / p95
- 24h Control Plane run数
- active / cancelled / duplicate run数
- notification health
- Canary health
- wake coalescing状態

巨大な別管理アプリは作らない。

## Safety

- main / Productionへ develop Integrationからpushしない。
- force pushしない。
- branch protection、review、thread、hold、Depends-On、exact-head fast/browser gateを迂回しない。
- active DEV Publisherのexact snapshot ownershipを尊重し、公開中SHAを追い越して追加mergeしない。
- 重いfull regression / P2Pは通常DEV deliveryと分離したままにする。
