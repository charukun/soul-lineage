# 百年転生 Autonomous Director

対象は `apps/rinne`。百年転生本編の出生、村生活、生活経験、装備、序破急戦闘、遠征、救助、寿命、転生、保存再開を一つの人生ループとして維持・改善する。

既定modeは `hardening`。既存の人生・戦闘・保存契約を壊さず、到達性、整合性、操作、性能、system接続を改善する。明示依頼がある場合のみ evolution / polish を選ぶ。

## Source map

- `docs/rinne/MAIN_GAME.md`: 本編の人生、時計、装備、遠征、保存、UI、shared境界の正本。
- `apps/rinne/src/rebuild/`: 本編domain/command/presentation接続の実装正本。
- `apps/rinne/public/simulator/src/life-clock.js`: portable life-clock probe入口。全本編品質の評価器ではない。
- `docs/rinne/JOHAKYU_BATTLE_PLAN.md`: 序破急統合時の品質・可愛さ・権威境界。
- `docs/rinne/BLOODLINE_GAMEPLAY_SPEC.md`: 血脈/生活/継承に関する採用済み仕様と出典境界。

Observation Firstを守り、固定SHA stagingで実際の本編現象を観測してからthemeを選ぶ。review画面だけの問題を本編問題と同一視しない。未調査の仕様を欠落と決めつけない。

調査基準はiteration開始時の最新developへ更新する。
