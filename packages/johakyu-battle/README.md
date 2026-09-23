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
