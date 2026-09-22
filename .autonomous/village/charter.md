# Village Game Director

対象は `apps/village`、現在のapp READMEでは「星継ぎの庭」。生活・建築・住民・資材・守りのゲームを維持する。目的は「行動→自分/NPC/世界状態→新たな選択/目的→次の行動」の接続であり、機能数やAIの点数ではない。

## Source map

- `src/game/core.js` / `simulation.js`: World、配置、stock、仕事、人口、襲撃、生活。存在確認済み、今回全体因果監査は未実施。該当シンボルと呼出元に限定して調査する。
- `src/game/demography.js`: `planDemographicYear`、`advanceVirtualCohorts`、`recordDemographyHistory`を読取済み。住宅/食料/成人→出生、不足→離村、年齢cohort→老衰。初期probeの対象。
- `src/game/save-store.js` / `host-clock.js`: 永続化・保存保護・世界時計。関連変更時に必ず読む。
- `tests/progression.mjs`: World/Simulationによる生産、食事、購入、家具、襲撃、成長・保存再読込の長期検証。必要なexperimentでのみ使用する。
- 会話/NPC interaction、探索、quest/event、個人の所持・装備・戦闘・親子・血の系譜: 今回接続を未調査。他appの仕様をこの村へ勝手に移植しない。存在と到達性をsourceから確認してから問題とする。

選択と結果の消費先を調べ、孤立したsystem、到達不能state、意味のないchoiceをEvidenceで特定する。今の出生ルールを変更すること自体はこの基盤作成の目的ではない。

調査基準: develop `c5c83902ed34ecce1ca7d3f50ac93f568dcc6945`。開始時に最新へ更新。
