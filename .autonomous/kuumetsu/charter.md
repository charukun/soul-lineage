# 喰滅廻遊 Combat Director

対象は `apps/demon` の単独狩り。存在を確認していないparty編成を追加するのではなく、現存する「戦闘前判断→戦闘展開→結果→捕食/帰還報酬/成長→次の狩り」の因果を調べる。

## Source map

- `src/hunt/balance.js`: `huntPlan`、`bodyStats`、`growthFor`、`settleProgress`、legacy `buyUpgrade`。species/HP/tempo/movementとmission/forage、帰還検証、報酬、chapterの直接sourceを読取済み。初期probe対象。
- `src/hunt/session-loop.js`: `skillSet` はnative recipeへtempoを接続。`nextHuntPrey` はshelter/捕食可能体/marked target/距離+maxHPで候補を選択。初期同時接敵cap2、後半cap4。判定source確認済みだが勝率/全戦闘時間の測定は未実施。
- `src/hunt/runtime.js` / `profile-store.js`、`@soul/raid`: 保存・捕食・帰還・再入場ledger。native統合testを再利用。
- `@soul/tidebreak-combat`: authored 序破急、間合い、strike、skill/runtime。`tests/hunt-loop-native.test.mjs` は実engineのloadout/tempoと実store/sessionの報酬loopを検証する。別の簡易damage式で置換しない。
- party編成、enemy差の勝率、target/skill別damage distribution、status effects、HP時系列: 今回probeの対象外。存在/実接続と再現可能な観測口を確認してから次のexperimentを選ぶ。

初期probeは帰還成否→報酬/成長、species/legacy upgrade→parameter差を検証する。parameter差だけで戦闘結果差や面白さを証明したことにはしない。

調査基準: develop `c5c83902ed34ecce1ca7d3f50ac93f568dcc6945`。開始時に最新へ更新。
