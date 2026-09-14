# Integration Autonomous Delivery v4

Control Plane v2（旧 #223）とAutonomous Delivery v3（旧 #225）を最新`develop`上で一本化し、Ready PRが大量に発生しても安全gateを維持したままDEV到達を自己最適化する制御面。

## 正本と統廃合

- 実装PRは #238。
- #238 は #223 / #225 の後継で、旧PRを並行運用しない。
- 今後のcontrol-plane PRは本文`Supersedes: #N`を使える。ただし自動closeは、旧PRのchanged pathすべてについてreplacement headと`mode:type:blob SHA`が完全一致するときだけ許可する。AIの意味類似では閉じない。
- control-plane pathだけのtrusted PRには既存Integrationが`integration:control-plane` / `integration:repair`を自動付与できるが、review/thread/hold/exact-head gateは維持する。

## Integration Controller / DEV Publisher

`deploy.yml`を外部gatewayとして維持し、Ready評価・merge・Rescueは`integration-controller.yml`、公開はDEV Publisherへ分離する。

- Controllerは`integration-controller-develop` concurrencyで直列化し、wake stormをcoalesceする。
- merge後はGITHUB_TOKENのpushイベント発火に依存せず、`publish_only=true`でPublisherを起動する。
- Queue Recoveryは`rescue_mode=scan`でController内の観測専用jobを使い、mergeやbranch editをしない。
- PublisherはPages / PULSE / source照合 / focused browser / DEV statusを担当する。
- main / Productionは明示許可なしでは変更しない。

## Stack-native CI

`Depends-On:`が1本のstacked PRについて、親exact headの証拠を安全に再利用する。

再利用条件:

1. 子はsame-repository / open / Ready / base=develop / current exact head。
2. 親もsame-repository / develop PRで、closed-unmergedではない。
3. 親exact headの通常`fastGate()`が成功済み。
4. GitHub compareで親exact headが子exact headのexact ancestor。

成立時だけ子の`validate.mjs fast`のbaseを親headへ変更し、親で既に検証した差分を再実行しない。`Affected browser smoke`は子exact headで引き続き実行し、Integrationのmerge直前再取得も維持する。複数直接依存、証拠不足、ancestor不成立は通常full pathへfail openする。

## Gate Cost Optimizer

品質gateは削除せず、安価な失敗検知を前段へ置く。

- `git diff --check`
- changed JS/MJSの`node --check`
- control/browser/shared path profileとFailure Fingerprint履歴からpreflight順序を記録
- その後の既存`validate.mjs fast` / affected browser smokeは必須

安い構文・契約違反をinstall/build/browserより先に落とすための順序最適化であり、成功条件の削減ではない。

## Queue pressure / Critical Path / Virtual Train

Flow pressure:

- Ready + AI repair 0〜4: `NORMAL`
- 5〜9: `BUSY`
- 10以上: `BURN_DOWN`

BUSY以上では非緊急Code Health PR生成を停止する。Ready件数取得に失敗した場合もfail-closedで新規maintenanceを増やさない。監査自体は続ける。

`Depends-On:`をDAG化し、後続PRを多く解放するrootへbounded priority boostを付与する。Rescue返却headと`integration:repair`はさらに優先する。

BUSY/BURN_DOWNではscope証拠がGREENの独立PRを2〜5件、一時`automation/integration-train-*` branchへexact head順で合成する。synthetic treeに通常fast validationとaffected Chromium smokeを実行し、base develop不変・candidate head不変・fast/browser成功の証拠だけ`validated`として優先順位へ使う。一時branchは成功/失敗/例外時に削除し、強制終了の孤児refも次回bounded cleanupする。Virtual Trainは個別PRのreview/check/merge直前再取得を代替しない。

## Stack Auto-Reconciler

全依存がdevelopへmerge済みのstackを、`contents:write`を持つtrusted Rescue Return laneだけが最新developへ通常merge-forwardする。

- force push / rebase禁止。
- head/develop/review/thread/hold/dependencyをwrite直前に再取得。
- Queue Recoveryは候補検知だけでbranchを書かない。
- conflictは書き換えずRescueへ残す。

## Quarantine / AI Deep Repair

同一exact headでobservation-only churnを除く意味のある失敗が3回以上、かつ正規化原因が2種類以上なら通常Trainから隔離する。

- `integration/quarantine=pending`
- `AI_DEEP_REPAIR_REQUIRED`を冪等コメント
- 既存ChatGPT Work repair laneが深い修復を担当
- 新headは旧headのQuarantineを継承しない
- human-required / product decisionは自動解除しない

## Failure Fingerprint Library

Rescue state内にboundedな失敗知識を保持する。独自DBやモデルAPIは使わない。

主なfingerprint:

- browser selector strict
- develop/baseline advance
- retained asset transient HTTP
- Git tree 422
- stale head / contract change
- dependency wait
- browser gate
- validation gate
- API throttle

SHA、URL、大きなrun ID等を正規化して同じ原因を束ね、過去に`RETURNED_TO_INTEGRATION`まで成功した回数と安全playbookを記録する。Astra相当Workへの修復コメントへ既知playbookを添付できるが、成功statusやmerge承認を生成しない。

## Bounded adaptive tuning

直近のReady demand、Draft→DEV p95、24時間内のfailure率、GitHub API余力から次だけを調整する。

- Virtual Train: 2〜5
- Rescue workers: 3〜6
- high-cost evaluations: 12〜24

failure率25%以上またはAPI余力不足では下限へ縮退する。BURN_DOWNかつDraft→DEV p95が20分以上なら上限へ寄せる。scan 60秒 / queue stall 5分 / retry 2分は固定。runtime auditは固定6/24ではなく許可range内を検証する。

## Semantic Supersession

stale Readyはboundedに棚卸しする。

- exact headがdevelop ancestorなら従来どおりclose可能。
- ancestorでなくても、PR touched pathすべての`mode:type:blob SHA`が現在developと完全一致する場合だけ内容包含を証明できる。
- close直前にhead/develop/body/labels/review/unresolved thread/hold/dependencyを再取得する。
- 類似コード、同じ目的、AI判断だけではcloseしない。

## DEV Candidate → Promote

Publisherが作った同一`_site`をPages公開前にlocalhost candidateとして起動し、既存`verify-browser.mjs`をそのcandidateへ実行する。

`build → site byte dedupe → candidate focused browser → Pages promote → public HTTP/source → public focused browser`

candidate失敗時はPagesへ触らない。Productionは既存blocking browser gateを維持する。

## Last Known Good DEV recovery

public promote後にだけ判明するHTTP/source/browser failureに備え、verified DEVごとに完全`_site`を`dev-lkg-site-<SHA>` artifactとして14日保持する。

- LKG候補はsame repositoryの非expired artifactのみ。
- current SHAを除外。
- artifact名SHAと`deployment-manifest.json`の`validatedDevelop` / DEV snapshot commitが一致しなければ拒否。
- prior workflow run IDを保持し、別run artifactを明示的に取得する。
- rollbackはPages配信物だけ。develop commit、PR、main、Productionは巻き戻さない。
- current developは`integration/develop=failure`のままでRescue対象にする。
- public siteだけLKGへ戻せた場合は`integration/dev-fallback=success`を記録する。

## Delivery Ledger / PULSE

Rescue stateに最大120件・7日の配送ledgerを保持する。

- Draft PR作成時刻（Repository上の実装開始近似）
- Ready初回観測
- Merge
- verified DEV

DEV時刻はcurrent developの`integration/develop=success`とmerge commit包含を確認した場合だけ記録する。

PULSEは次を表示する。

- Draft→Ready p50/p95
- Ready→Merge p50/p95
- Merge→DEV p50/p95
- Draft→DEV p50/p95
- NORMAL / BUSY / BURN_DOWN
- Auto tuning
- Validated Virtual Train
- Quarantine件数
- Failure Fingerprintの成功回数/観測回数

これはChatメッセージ送信時刻ではなくRepositoryのDraft PR作成時刻を起点とする。

## Safety

次はv4でも変更・弱体化しない。

- exact-head fast/browser evidence
- Changes Requested / unresolved review thread
- explicit hold / Draft / external or untrusted PR
- `Depends-On:`
- browser repair ownership
- schema/save/protocol/contract/product decision
- merge APIのexact head
- main / Production boundary
- no force push

新しいOpenAI API、paid model API、PAT前提、常駐server、独自task DBは追加しない。既存GitHub Actions / Integration / Rescue / PULSE / ChatGPT Workを使う。
