# develop Integration

## 責任分界

実装セッションの終了条件と待機禁止の正本は [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md)。通常実装はDraft PR → 実装・高速検証・push → Ready → `READY_FOR_INTEGRATION` handoffで終了します。

Ready後のCI監視、保留理由の判定、develop統合、DEV公開、公開HTTP/source照合、focused browser gate、失敗時の修復差し戻しはIntegrationの責任です。main / Productionは明示的に許可された作業以外では変更しません。

## Draft → Ready

Draft中は `Draft lightweight check` だけを実行します。これはpatch whitespaceなど、作業中branchを壊したまま放置しないための軽量gateです。install/build/browser/IntegrationはDraftでは実行しません。

Ready化すると `Validate and build`、影響範囲browser smoke、repair記録、`Request Integration` が有効になります。Ready用fast gateはDraft lightweight checkでは代替できません。

## Integrationの起動

Ready時点で、CIの既存 `Request Rescue observation` jobがbuild/browserへの`needs`なしで起動します。trusted developの `implementation-handoff.mjs` が最新PRのReady/base/repository/headを再確認し、`implementation/handoff=success` と同一PR/headの受領コメントを記録、設定済みntfyへ `READY_FOR_INTEGRATION` を送ります。これは実装責任の終了でありCI成功ではありません。Workerはこのjobの完了も待ちません。通知失敗は警告と受領コメントへ残し、通常CI・Rescue dispatchを止めません。

Ready PRのfast/browser gate成功後、`Request Integration` がdevelop上の既存 `deploy.yml` をworkflow dispatchします。developへのpushもIntegration/DEV検証を起動します。

失敗やイベント欠落は既存Rescueと独立watchdogが再走査します。Ready受領に新しいworkflowの既定branch登録は必要ありません。導入PR自身はtrusted developにrecorderがまだ無いため既存Readyイベントへhandoffし、recorder確認はローカルのAPI fixtureで行います。導入のための先行mergeやmain変更は不要です。

Integrationは起動イベントのPRだけを見るのではなく、その時点のdevelop向けReady PRを全件再走査します。高コストなexact-head評価は1run最大12PR、mergeは1バッチ最大8PRとし、依存関係を複数passで再評価します。Integration本体には6分の処理予算を置き、jobの10分timeoutより前に診断情報を残して未処理PRを次runへ引き継ぎます。明示holdやrecovering中の通常PRなど、安価に確定できる保留は高コストなCI/review/compare取得より先に判定します。

Integration評価は `integration-develop` concurrency groupで直列化し、GitHub Pages公開・focused browser verificationは `pages` concurrency groupで別に直列化します。これにより、重い公開/browser処理が進行中でも次のReady検知とIntegration評価自体は待たされません。一方、developの `integration/develop` statusがpending/failureの間は通常PRの追加mergeを許可しないため、未検証baselineへ連続mergeしません。PR browser repairの記録は `.github/workflows/browser-repair.yml` の `browser-repair-pr-<PR番号>` groupへ分離します。

## GitHub APIの取得予算と診断

Integrationは安全条件を減らさず、同一run内の重複取得を削減します。

- 初期評価中のimmutableなPR head単位データだけrun内GET cacheを使います。merge直前のPR、review、thread、Checks/status、develop SHAはcacheを使わず必ず再取得します。
- generic paginationを100ページまで無制限に走らせず、用途別に上限を設定し、上限超過はfail closedで保留します。
- GitHub API request timeoutは既定15秒です。429、secondary rate limitを示す403、retry可能な5xxは有限回だけ指数backoffし、`Retry-After` / rate-limit resetを尊重します。長時間のrate-limit待ちはjob内で無理にsleepせず診断を残して停止します。
- request数、route別回数、cache hit、retry、throttle/timeout、rate-limit header、現在phase / PR、heartbeat、処理時間を `.deploy-state/integration-diagnostics.json` へ逐次記録します。
- `integration.json` と diagnosticsは `integration-report` artifactとして保持します。script内予算をjob timeoutより短くすることで、異常時もartifact upload stepへ到達できる設計にします。

## 自動merge条件

候補PRは次をすべて満たす必要があります。

- open、非Draft、baseがdevelop。
- headが同一Repositoryで、author associationがOWNER / MEMBER / COLLABORATOR。
- `integration:hold`、`integration:manual`、`do-not-merge`、本文 `Integration-Hold:` がない。
- `Depends-On` の全PRがdevelopへmerge済み。曖昧な記法や他Repository参照は不可。
- GitHubのmergeabilityが許可状態。
- 未解決review thread、Changes requestedがない。
- 現在のexact head SHAに対する最新fast gateが成功し、`pr-fast-<PR>-<SHA>` artifactが存在する。
- code gate対象の他Checks/statusが成功している。
- developの最終検証が失敗中なら、通常PRではなく `integration:repair` の修復PRを先に処理する。

merge直前にhead SHA、Ready状態、label、body、review、Checks、develop SHAを再取得します。途中で変化したPRを古い判定のままmergeしません。merge APIにはexact head SHAを渡し、force pushやbranch protection緩和は行いません。

## 自動化・基盤変更のtrusted exact-head authorization

`.github/**`、`scripts/**`、`AGENTS.md`、`docs/DEVELOPMENT.md`、`docs/INTEGRATION.md` などの制御面変更は、通常アプリ変更より強いレビュー条件を維持します。

このRepositoryは単独owner運用で、GitHubはPR作成者自身によるAPPROVEを許可しません。そのため、制御面PRが全ての安全条件を満たし、残る保留理由が「現在headへのmaintainer approval」だけの場合に限り、develop上で実行されるtrusted Integrationがexact-head authorizationを作成できます。

trusted authorizationは次の順で扱います。

1. same-repository / trusted author / Ready / holdなし / 依存完了 / review thread解決 / Changes requestedなし / current fast gate成功を先に確認する。
2. GitHub Actions botによるPR APPROVE作成を試す。成功した場合、そのreviewは必ず現在の `commit_id` と `Trusted Integration Review: exact head <SHA>` markerを持つ。
3. Repository設定によりbot review APIがHTTP 422で拒否された場合だけ、現在head commitへ `integration/trusted-review=success` statusを記録する。
4. status fallbackは同じtrusted Integration実行のメモリ内でだけexact-head approval evidenceとして扱い、eligibilityを再計算する。statusはcommit SHAそのものに紐づくため、head更新後には流用されない。
5. merge直前にPR mutable state、review/status、fast gate、develop SHAを再取得する。GitHubのmerge APIやbranch protectionが拒否したら停止する。

次はtrusted authorizationでは上書きしません。

- Changes requested、未解決review thread。
- explicit hold。
- 外部RepositoryのPRや信頼されていないauthor。
- Draft、依存未完了、CI/browser failure。
- stale head、偽marker、古いstatus。

`integration/trusted-review` は保護ルールの迂回ではありません。GitHub Actions review作成がRepository設定で使えない一人開発環境でも、develop側control planeがexact headに対して同じ安全判定を監査可能に残すためのfallbackです。将来branch protectionが独立reviewを必須化した場合、最終merge APIが拒否するため自動で停止します。

## develop baselineとrepair

Integration開始時に現在developの `integration/develop` statusを確認します。

- statusがない初回baselineは、追加PRをmergeする前に現developを検証・公開します。
- statusがfailure/pendingなら通常PRを止め、`integration:repair` の修復PRを優先します。
- repair成功後はReady PRキューを自動再走査します。
- 成功済みの同一最終SHAは重複build/deployを避けます。

browser failureは `docs/BROWSER_SELF_HEALING.md` に従います。修復ワーカーはassertion削除や検証条件弱体化で通しません。PR scopeとdevelop scopeを区別し、machine-readable repair ticketのattempt/claimを尊重します。

PR browser smokeの結果記録は `browser-repair.yml` へdispatchします。DEV公開後のfocused browser結果はdevelop repair ticketへ記録します。repair recorderとDEV Integrationは別concurrencyなので互いのpending runを置換しません。

## DEV公開

IntegrationがPRをmergeした最終develop SHAを正本として、影響範囲をbuildします。不変appとProduction snapshotはhash検証して保持し、develop Integrationからmainを昇格させません。

Pages公開前にdevelopが期待SHAから進んでいないことを確認します。公開後はmanifest、入口、assets、source commitを照合し、focused browser verificationを実施します。成功時だけ最終SHAへ `integration/develop=success` を記録します。

focused browser failure時は公開runをfailureとし、repair ticketを作成します。HTTP 200だけ、あるいはdeploy action成功だけをDEV成功とは扱いません。

重い全体回帰・public WebGL2/P2P diagnosticsは通常DEV deliveryから分離し、必要時に `full_verification=true` で実行します。通常Integrationの速度と、重い診断の品質基準を混同しません。

## PULSEとの責務分離

PULSEはCloudflare Workerの定期refreshでGitHub状態と公開manifestを軽量収集し、Integration/Pages jobの完了待ちを状態更新の前提にしません。`Deploy DEV and PROD` workflow全体がactiveであるだけでは「Integration中」と表示せず、公開/browserを含むdelivery中としてheartbeatとphaseを返します。10分以上heartbeatが更新されないactive deliveryは停止疑いとして検知します。

`integration:hold`、`integration:manual`、`do-not-merge`、本文 `Integration-Hold:` のPRは意図的保留として扱い、CI成功後のstale Ready alertへ誤分類しません。WAYFINDERはPULSEの公開stateを正本として参照し、重いIntegrationロジックを自身で再実行しません。

## 保留と再起動

各PRのheadに `integration/queue` statusを記録します。

- merge済み: success + merge SHA。
- 保留: pending +具体的な理由。

`integration/queue`、`implementation/handoff`、`Request Integration`、`Request Rescue observation` はcode validation gateから除外します。受領・通知・起動処理をcode gateへ混ぜて自己待機することを防ぎ、fast artifact・build・browser・他のChecksは維持します。

統合batchは `INTEGRATED`、最終 `integration/develop=success`（DEV公開・HTTP/source・focused browser成功）後は `DEV_DEPLOYED` を既存ntfy設定へ通知します。通知失敗で統合・公開判定を変更せず、Actionsへ警告を残します。

一時的なmergeability=nullは短時間だけ有限再取得します。API失敗、developの予期しない移動、大規模なbase比較など、確実な判定ができない場合はfail closedで保留します。

成功後に未処理PRが残り、baseline復旧・repair復旧・同一バッチのmerge進展など次の再走査に意味がある場合だけ再dispatchします。進展不能なholdだけで自己ループしません。

## 失敗時の原則

- CI失敗: exact headと失敗runを根拠に修正ワーカーへ返す。
- browser失敗: self-healing ticketから原因を特定し、最小修正する。
- deploy/公開照合失敗: `integration/develop=failure` のまま通常mergeを止める。
- repair記録run失敗: DEV Integrationをcancelせず、repair記録側だけ復旧する。
- session停止: Repositoryのbranch / commit / PR / handoff / CI状態から別sessionで続行する。
- GitHub経路1つの失敗だけで作業不能と判断しない。

main / Productionを変更する作業はこのdevelop Integrationの対象外です。

## Integration Rescue の責任境界

Ready PRの修復は独立したCoordinatorと複数のPR単位Workerで行い、通常Integrationの最終判定から分離する。変更scopeとDepends-Onを比較し、独立PRを並列、関連PRを再評価付き並列、競合PRを先行PRのdevelop統合後の次Waveに振り分ける。claim・heartbeat・有限retryをGitHubへ記録し、PULSEはその観測ビューとする。修復pushはmerge成功を意味せず、exact-head checks・review・thread・dependency・baseline・merge直前再検証をすべて通常Integrationへ戻す。明示holdの解除、force push、main / Production変更は行わない。

実装・設定・独立watchdog・PULSE・復旧手順は [Integration Rescue](INTEGRATION_RESCUE.md) を参照。

## Bootstrap例外の扱い

trusted review機構そのものを導入したPR #76と、repair recorder concurrency分離を導入したPR #54は、旧仕組みでは自分自身のデッドロックを解消できなかったため、exact-head CI成功確認後に一度限りのbootstrap mergeを行いました。これは移行履歴であり、通常運用のmerge経路ではありません。
