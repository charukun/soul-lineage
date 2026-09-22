# Integration Fast Lane

> Compatibility entrypoint. 現在の develop Integration の正本は [`INTEGRATION.md`](INTEGRATION.md)。このファイルへ別の merge 規則を追加しない。

通常経路は、Ready PR の current exact-head fast evidence と安全条件を確認し、single expected-head writer が通る PR から develop へ merge する。browser smoke、DEV publication、`integration/develop` は非同期で追従し、独立した eligible PR の global blocker にしない。

機械的に安全な stack/base 更新だけ Fast Repair が扱い、意味衝突は Deep Repair へ渡す。旧 Rescue queue / Wave / Virtual Train を通常 merge authority として復活させない。

PULSE の通常表示は現在の Fast Lane と repair lane を分離し、履歴上の Rescue / Train 指標を現在の統合待ち件数として扱わない。

exact-head gate、review / hold / dependency、single writer、main / Production の品質 gate は維持する。詳細・受入条件・DEV Publisher 契約は [`INTEGRATION.md`](INTEGRATION.md) を参照する。
