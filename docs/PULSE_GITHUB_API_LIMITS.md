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
