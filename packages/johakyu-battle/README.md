# 共通 序破急バトル

監査基準: `develop@0a7eb58151a83214b505f8b8390006b5a509e40d`。
Battle2 の当時の `johakyu-p7-review` は、domain actor と capability を利用しつつ、技の短縮定義、連の進行、間合い、反応、contact、学習用イベントをLab内で所有していた。本編は別のTidebreak executorを使っていた。新しいconsumerは両方とも `createJohakyuBattleRuntime` を使用する。

## 境界

| 所有者 | 責務 |
| --- | --- |
| game-data | 基本型、技の段、武器適性、閃きレシピと因果条件 |
| johakyu-combat | 身体・負傷・装備資格・staminaの見積りと一度だけの支払い、接触の意味、exchange reducer |
| johakyu-battle | Technique、Phase、Chain、Execution identity、間合いの意思決定、共通時計、contact authority、ImpactResultと適用、snapshot/event |
| johakyu-presentation | authored clip・素材・実武器軌跡・VFX・SFX・camera・身体recoil。結果の変更は禁止 |
| 百年転生 | 人生・年齢・習得と試行・保存・転生・報酬・前線の進行。WeakMapで実行sessionを保持し、保存には持ち込まない |
| Visual Review Lab | 装備/技の選択、試演用ロスター、出現・再戦、レビュー内だけの発見。人生saveへの参照なし |

## 連・技・段

Phase は序/破/急という戦術上の局面。各Phaseに1〜3個のTechniqueからなるChainを装備する。Techniqueには元レシピの全Stageを保持する。Stageを3個のPhaseへ分割しない。Executionは一回のStage開始ごとに一意で、武器変更・中断・再開後の古いcontactを再利用しない。手動の一動も同じTechniqueを `one` scopeで実行する。

UIのID → TechniqueDefinition → TechniqueExecution → contact/ImpactResult → Presentationを同じ `techniqueId` と `stageIndex` で追跡する。`kind / footwork / charge / weapon / phase / chainId / attackId` もイベントへ残す。対応しないstageは `execution-blocked: unsupported-stage`。無関係な攻撃clipへ置換しない。

## 読み合いと力

武器reach、preferred spacing、engagement range、心得6軸、構え、stamina、posture、initiativeとPhaseから接近・誘い・回り込み・迎撃・防御圧・離脱を選ぶ。序は観察時間、破は圧力と競り合い、急は好機への踏み込みを変える。強パリィは攻撃を中断して主導権とcounter windowを防御側へ渡す。同時の踏み込みはclashとなり双方を中断する。

Impactはdamageとは別に、bodyPart、power/momentum、吸収・逸らし、posture/stamina損失、stagger、反動、方向付きimpulse、deep hit、guard break、hitstopを解決する。位置への衝撃速度は指数減衰で積分し、戦術的retreatから分離する。通常斬撃は小さい身体反応、重量打撃は長い予備動作・強い抵抗・姿勢崩し・長いrecoveryを持つ。

## 一つの時計

anticipation → commit → execute → contact/impact → followThrough → recovery。正規化contactProgressが唯一の接触アンカー。共通時計がhitstopで止まり、Animationはその進捗を直接サンプリングする。命中、防御、ダメージ、recoil、VFX、SFX、cameraは一つのcontact eventから発火する。

実武器のanchor/tipを毎描画採取してtrailを生成する。パリィ火花はそのフレームの二つのbladeの最近接位置を使う。描画の観測座標は診断専用で、判定・部位・damageに影響させない。これによりheadless本編・Lab・フレームレート差で結果を変えない。contactの判定はsemantic reach/trajectoryと共通アンカーであり、GLBの三角形同士の物理衝突ではない。

Presentationの解決順はTechnique+Stage固有 → kindのauthored binding → archetype styling。返しと打ち崩しには段ごとのtrail/impact役割を定義する。素材名はCombatへ渡さない。

## 移行と検証

Battle2のモデル、森、照明、Bloom、camera、開始操作、心技体装、序破急予備動作、実武器trail、パリィrecoil、ダウン、葬焉、不殺、1v3を保持した。旧Labの固定burst定義と支払いadapterはconsumer移行後に除去。著作clip bindingはCombatからPresentationへ移した。旧Tidebreak packageは他の既存consumer/互換読み込みに残るが、百年転生の前線tickは呼ばない。

本編の閃きは同じTechniqueをtrialとして実行する。Combatのstage-start/completed/contact/interruptedから完遂を確認して人生側が習得を確定する。learned/equipped/archivedは人生側の資格。保存はHP・負傷・習得・装備を保持し、時計・段の途中・hitstop・Presentationを除く。

Focused testsは全対応カタログの実行identity、同時clash、強弱parry、guard break、軽重impact、renderer非干渉、stamina、複数敵、本編保存/再開、Labの葬焉/不殺を検証する。旧固定3段burstや旧authorityのassertionは新contractの因果検証へ移した。workflowやFast DEV runnerは変更しない。

実ブラウザ: 既存 `apps/review/scripts/nocturne-browser.mjs` を `JOHAKYU_MODE=shared` で実行。immutable Beforeは `BEFORE_ROOT / BEFORE_SOURCE_SHA`。本編は `apps/rinne/tests/johakyu-shared-battle.browser.mjs` の保存→タイトル実入力→実戦→保存→再開。証拠はexact source SHAとスクリーンショット・イベント観測を含める。software WebGLでの証拠は実機FPSの合格を意味しない。


## 戦闘状態の所有と更新順

Mutableな正本はruntime内のactor。`state.js` の `readBattleActorState` はその読み取り専用projectionで、別の保存状態ではない。
`state.phase / canDecide / canMove / rootLocked / weapon` を判断・移動・表示で共用する。
死亡、ダウン、出現待ち、葬焉、怯み、攻撃、残心、葬焉位置取り、構え、接近、待機の優先順位をここで固定する。

| モジュール | 所有する処理 |
| --- | --- |
| runtime | 入力同期、共通時計、更新順、接触結果の適用 |
| state | 状態の読み取りと行動・移動・武器表示の可否 |
| targeting | 生存・出現資格を共有した対象選択と脅威判定 |
| decisions | 戦術判断から攻撃・葬焉位置取りのcommandを選択 |
| execution | 段の開始・完了・中断、連の進行、待機中の指示の一括解除 |
| lifecycle | 倒れ込み、葬焉の両者予約、接触後の死体、残心開始・中断・終了 |
| movement | 正本座標の更新、root lock、境界内の分離補正 |
| snapshot | 完了したstepのimmutable frame。読み取りによる状態変更は禁止 |

更新順は、無効な参照の解除 → 行動時計とcue → 閃き要求 → 判断 → 残心 → 移動 → 接触 → lifecycle確定 → engagement確定 → snapshot。
装備変更・対象消失・中断は `execution.cancel` でaction、queue、連、counter、追撃、位置取りと両者の葬焉予約を一括解除する。
処刑済みの相手を解除しても生存・完全ダウンへ戻さない。

Hostの復帰は `recoverActor`、roster/装備の変更は `sync` を使う。毎frameの `downed:false` 同期は、進行中の葬焉socketを消さない。
百年転生は同じ `state` とengagementをpose経由で表示へ引き渡す。Battle2は設定変更ごとに表示sessionを更新し、古いrevisionや武器poseを再利用しない。
全semantic eventはidを持ち、表示driverが開始イベントを欠落させず一度だけ配送する。
