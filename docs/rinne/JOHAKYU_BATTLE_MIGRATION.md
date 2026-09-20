# 序破急バトルシステム 統合差分台帳

調査・実装基点: `58eef3ac264aa7f43bf24d9a7cf78c09d1600d26` (2026-09-21)。
上位計画: `JOHAKYU_BATTLE_PLAN.md`。原型: `JOHAKYU_BATTLE_BASELINE.json`。原型記録は更新しない。

## 段階と受入

| 段階 | 状態 | 今回の受入対象 |
| --- | --- | --- |
| P0 | developへ統合済み | 名称と不変の原型記録 |
| P1 | 実装中 | 副作用のない観測契約、識別子、仕様の差分分類 |
| P2 | 未着手 | 序破急と意識が実行動を決める接続 |
| P3 | 未着手 | 六部位、スタミナ、勝敗の単一権威 |
| P4 | 未着手 | catalogと装備・技・試演の区別 |
| P5 | 未着手 | 遭遇、複数体、本編入力 |
| P6 | 未着手 | 本編command、人生、保存・再開 |
| P7 | 未受入 | 固定Before/After、通常操作一巡、実機性能、採用 |

各段階の実装と受入を分ける。未受入を本編既定へ切り替えない。各段階の検証済みPRをdevelopへ統合して既存の非同期DEV公開を開始する。main / Productionは対象外。

## 旧側から取り込むもの・取り込まないもの

出典はすべて上記SHA。分類は「確定した契約」「調整中の実装」「レビュー専用」「新側へ未接続」を区別し、旧側が動くことだけをもって新側への移植済みとはしない。

| 領域 | 分類 | 出典・現状 | 接続上の制約 |
| --- | --- | --- | --- |
| 出生・寿命・年齢資格・時計 | 確定した契約 / 新側へ未接続 | `docs/rinne/MAIN_GAME.md`: 0歳、60秒/年、100歳、武具7歳、遠征15歳、5世界年の出航、8実秒の生活行動 | 世界時計倍率を移動・戦闘のdtへ掛けない |
| 編成・catalog | 確定した契約 / 新側へ未接続 | `MAIN_GAME.md`: ゲームcatalogが候補の正本。現行候補は利用可能として開始 | UI独自の候補・能力解禁を生成しない |
| 意識・六部位 | 調整中の実装 / 新側へ未接続 | `apps/rinne/src/rebuild/combat-choreography.js`: `normalizeCombatStrategy`, `combatBodyOutcome`, `applyChoreographyImpact` | six-part injuryとHPを一命中で一度だけ適用。表示時にensure関数で元stateを変更しない |
| 自動戦闘・遭遇 | 調整中の実装 / 新側へ未接続 | `apps/rinne/src/rebuild/combat-core.js`: `createFront`, Tidebreak session、downedとfinisherの区別 | 新旧のsimulationを同じstateへ同時に書かせない。downedをdeadと同一視しない |
| 閃き・連の試演 | レビュー専用 | `apps/rinne/src/review-battle.js`: `previewTechniqueChain`, `handleInspirationCue` | 試演・任意生成を本編の習得や保存に流用しない |
| actor/impactの境界 | 再利用できる契約 / 新側へ未接続 | `packages/tidebreak-combat/shared-runtime-facade.js`: `snapshotActor`, `impactState` | actor ID、source/target ID、impact serialを保持。旧pose・カメラ・hitstop数値を描画へ直適用しない |
| 新側の三打目・wave・burst・回復 | デモ専用 | `apps/review/src/nocturne/runtime.js`: `startAttack`, `wave`, `castBurst`, `damage` | 三打目を正式な急と呼ばない。wave/自動回復/burstを本編仕様にしない |
| 保存・装備変更・転生 | 確定した契約 / 新側へ未接続 | `MAIN_GAME.md`: canonical command、environment別envelope、Web Locks、破損保存の保護 | adapterは保存しない。無効なcommandをUIで迂回しない |

## P1 観測境界

新側のnative simulationは引き続き唯一の所有者。bridgeは読取専用で、乱数・時間・damage・回復・装備・保存・音・描画を実行しない。観測のためにゲームの乱数を消費しない。

battle IDはページ内boot epochとroundで識別し、actor IDは生成時から除去まで安定させる。ページを跨ぐ永続的IDや正式な人生IDとは偽らない。攻撃・impact IDは所有simulationが付与する。発生していない正式phaseやimpactを観測側で推測生成しない。

snapshotはplain dataを複製して再帰的にfreezeし、Three object、mixer、sound、storage、runtime commandを漏らさない。未接続のphase、stamina、body、catalogはnullまたは未対応として明示し、デモ値から合成しない。native-demo由来のsnapshotを本編stateへ書き戻すAPIは提供しない。

読み取り失敗を戦闘更新へ波及させない。未準備時はsnapshotなし。bridge無効時と読取を繰り返した時のseed、戦闘trace、元state、描画コードの同一性をfocused testで確認する。

## 後続段階の安全条件

本編domain -> 検証済みsnapshot/semantic event -> presentation adapter -> 現行モデル・clip・VFX・音の一方向とする。app間importは追加しない。共通化はpackagesへ行い、旧ロジックのコピーを二重管理しない。

対応するclipのない技を別の無関係な動きで成功扱いにしない。技ID、武器、phase、攻撃instance、命中窓を対応表で確認する。未対応は検出し、対応・受入前には本編既定にしない。

可愛さ・品質の比較は固定source SHA/viewport/seed/遭遇/経過時間に紐付ける。ソース同一性と実画面比較は別の証拠。headless結果をPixel Fold実機FPSと表示しない。因果テスト、固定Before/After、保存互換を満たさない統合は採用しない。

## ロールバック

段階ごとのPRを単位に、最後に受入済みの状態へ戻す。bkおよび他タスクの変更は巻き戻さない。P1は保存を書き換えないので保存migrationを要しない。P6以降の戻し方は保存互換の検証と同時に定める。
