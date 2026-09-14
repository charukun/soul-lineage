# Integration Rescue idle backlog wake

## Task

AI修復待ちが存在し、修復可能な候補とWorker空き枠があるのに `ACTIVE 0 / maxConcurrency` が継続する状態を自動検知・復旧する。

## Acceptance

- recoverable `FAILED_MANUAL` を最新の Work Repair eligibility と所有権・scope fenceで再評価する。
- unblockedなAI修復候補が1件以上あり、Worker空き枠がある場合は durable wake signal を残し、既存のIntegration/Rescue経路から即時再評価できるようにする。
- explicit hold、Changes Requested、未解決thread、Draft、Browser Repair所有、dependency wait、RED scope lock、exact-head fenceを迂回しない。
- PULSEで `ACTIVE 0` が「全候補blockedで正常待機」か「eligibleなのにidleで異常」かを区別し、原因と次アクションを表示する。
- ACTIVE値は実worker lease / Work Repair `working` の実数のみを表示し、見かけ上の数値を水増ししない。
- main / Productionを変更せず、既存品質gateを弱めない。
