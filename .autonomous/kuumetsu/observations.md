# 観測

## K-001: 帰還→報酬→次の判断のpure入口

`src/hunt/balance.js::settleProgress` はreturnVerified、status、捕食数、canonical planを使って報酬を確定する。`bodyStats` は永続成長/種族/記憶をHP/tempoへ反映する。依存なしmoduleなので描画なしで同条件比較できる。`tests/hunt-loop-native.test.mjs` は実store/session/native engineへの接続を既にassertしている。

## K-002: まだ測れていない戦闘範囲

`session-loop.js::skillSet/nextHuntPrey` にtempo/target規則がある。現時点で編成差・敵特性別勝率・全battle duration・damage distributionを測ったわけではない。parameter差と戦闘結果差を混同しない。

## 外部feedback受付

日時 / 原文 / 参照 / 対象版 / 影響する仮説を追記する。ユーザーの体感は外部Evidenceとして尊重するが、codeだけでそれを実測したことにはしない。

調査基準: develop `c5c83902ed34ecce1ca7d3f50ac93f568dcc6945`。開始時に最新へ更新。

## K-003: 基盤の初回hosted失敗と依存境界

[失敗原本](../validation-attempts/1035-01.json): run 35457865372 は9ケース・15/21条件の比較に成功したが、app testからroot harnessへの相対importが既存architecture gateに違反して全体失敗。比較はroot toolingで実行し、app testはapp内native moduleのみ参照する。gateの例外化・動的importによる回避をしない。最終成功は同PRの別のexact-head receiptから確認する。
