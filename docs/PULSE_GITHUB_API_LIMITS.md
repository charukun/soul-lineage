# PULSE GitHub API 制限の診断・回復契約

PULSEのGitHub取得でHTTP 403/429やrate-limit backoffが発生した場合、単に「GitHubの利用制限」とまとめず、原因を判別できる証拠をstateへ残して安全に回復する。

## 調査で確認した問題

- `ops-board/github-client.mjs` は現在HTTP 403を一律にrate limitとして扱い、scope単位のbackoffを保存する。権限不足などrate limitではない403でも、後続refreshが「GitHubの利用制限による再取得待ち」になる可能性がある。
- authenticated/publicの区別とrequest capはあるが、保存しているrate metadataはremaining/reset中心で、limit/resource/used/retry-afterや制限種別をPULSEから判別できない。
- PULSE公開時のprimeはtarget attributionを進めるため最大3回の完全refreshを連続実行できる。1回のrefresh自体がboundedでも短時間に増幅できる。
- IntegrationとDEV/PULSE公開経路には同じ状態に近接して複数のauthenticated refreshを起こし得る箇所がある。安全確認に必要なGitHub current-state readは維持しつつ、PULSE表示更新だけの重複取得は増幅させない。

## 受入条件

- primary rate limitは`x-ratelimit-remaining=0`などGitHubのrate-limit証拠がある場合だけbackoffする。
- secondary rate limitはHTTP 429、`retry-after`、またはGitHubのsecondary/abuse rate-limit応答を根拠に分類する。
- rate-limit証拠のないHTTP 403はpermission/API errorとして扱い、共有backoffを汚染しない。
- stateへHTTP status、制限種別、scope、limit、remaining、used、resource、reset、retry-after、retry時刻を安全な構造化diagnosticとして残す。credentialやレスポンス本文全体は保存しない。
- PULSEの表示は「primary limit」「secondary limit」「権限/403」「内部request budget」を区別し、過去の正常snapshotを保持する。
- deployment primeは1回のauthenticated state refreshだけにし、target attributionの残りは後続イベント/定期reconcileへ委ねる。表示上はpendingを正直に残す。
- browser閲覧や「最新に更新」のGETだけでGitHub APIを直接消費しない既存契約を維持する。
- Integrationのexact-head、review、dependency、mergeability、DEV/Production品質gateは削減対象にしない。

## 認証必須化

PULSE runtimeからGitHub REST APIへ行う取得は、例外なく認証済みcredentialを必要とする。未認証の公開API枠を通常経路・fallback・Cron・cold-start・rate-limit retryのいずれにも使用しない。

- `createGithubClient` はtokenなしでGitHub network requestを実行しない。token欠落は `auth-required` としてfail-closedに扱う。
- Actionsからのevent refreshは、そのrunの一時 `GITHUB_TOKEN` を1回だけWorkerへ渡し、永続保存しない既存方式を使う。
- `OPS_GITHUB_TOKEN` が設定されている場合のみ、CronとDurable Object alarmがGitHub再取得を実行できる。
- `OPS_GITHUB_TOKEN` が無いCron/alarmはGitHubへ接続せず、最後の正常snapshotを保持する。
- cold-startでsnapshotもcredentialも無い場合、GitHub公開APIへfallbackせず `github_auth_required` としてfail closedにする。
- `/api/refresh` はrefresh credentialだけではGitHub取得を許可しない。`x-ops-github-token` またはWorker側 `OPS_GITHUB_TOKEN` が必要。
- ブラウザの `/api/state` GET と「最新に更新」は引き続きGitHub APIを直接呼ばない。
- 新しい未認証GitHub API経路を再導入しないことをfocused test / contract testで固定する。

## 更新経路の単一契約

PULSEの更新停止を局所的なcurl修正で再発させないため、Actionsから`/api/refresh`を呼ぶ実装は共通のauthenticated refresh clientへ集約する。workflowごとにAuthorization headerやGitHub credential forwardingを手書きしない。

- event refreshは常にserver-side refresh credentialと、そのrunの一時`GITHUB_TOKEN`の両方を同じ共通clientへ渡す。
- 共通clientはnetwork送信前に両credentialの存在を検証し、GitHub token欠落時はrequestを1件も送らずfail closedにする。
- 成功はHTTP 2xxだけで判定しない。`repository`、`schemaVersion`、`syncStatus=ok`、`githubApi.scope=authenticated`、有効な`generatedAt`を検証したresponseだけを成功とする。
- 429 / 5xx / transport errorのretryは共通client内の有限回数に限定し、permission/auth/schema failureはretryで隠さない。
- PULSE公開prime、runtime再利用refresh、DEV結果後refreshは同じclientを使用する。workflow内に独自の`api/refresh` curlを増やさない。
- DEV publication自体の成功とPULSE state refreshは分離する。refresh失敗でDEV公開済み事実を巻き戻さない一方、失敗を`|| true`で消さず、専用statusへ記録して診断可能にする。
- control-plane testはYAMLの特定の行配置や`split()`前提を固定せず、上記のcredential forwarding・共通client利用・失敗可視化という契約を検証する。

## Event-driven freshness 契約

PULSEの「鮮度」は単純な経過時間ではなく、最後に観測したGitHub状態が現在まで有効かで判定する。GitHub側に変化がない間、数時間経過した正常snapshotを異常扱いしない。

- PULSE表示へ影響するGitHub eventは薄いwake workflowで受け、状態取得ロジックを複製せず既存の`pulse-refresh.yml`だけを呼ぶ。
- wake対象は少なくともdevelop更新、PRのopen/close/synchronize/ready/draft、review状態変化、PULSEが参照する主要workflowの完了を含む。
- event refreshの重複実行はconcurrencyでcoalesceし、refresh protocolとcredential処理は`pulse-refresh.yml`/shared clientへ一本化したまま維持する。
- 保険として低頻度reconcileを許可する。reconcileはGitHub/PULSEのsource identityを比較し、差分が無ければ重い処理や再公開を行わない。
- UIは「最終取得からの時間」と「同期状態」を分離する。正常なら「GitHub状態を反映済み」と最終反映時刻を表示し、経過時間だけを理由に赤警告を出さない。
- 赤い更新遅延警告は、GitHub側の変化を検知したのにrefreshが失敗/未完了、snapshot sourceがcurrent developと不一致、またはsyncStatusが異常である場合に限定する。
- ブラウザの「最新に更新」はPULSE snapshotを再取得する操作であり、GitHub APIを直接叩くトリガーにしない。
- 既存のrate-limit/auth診断、exact-head Integration、DEV/Production品質gateを弱めない。
