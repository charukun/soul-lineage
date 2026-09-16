# 30秒演武 choreography v2

## 目的

30秒 Motion QA の後半を、同一斬撃の反復ではなく、実ゲームの `slash` が持つ複数の全身剣技バリエーションを連結した演武へ刷新する。

前回の `shino-slash-2` は一撃の重心・緩急・振り抜きを改善した。本対応は数値の微調整ではなく、攻撃モーションの構造を一段増やし、同じ gameplay 判定を保ちながら見た目の語彙と連続性を拡張する。

## 不変条件

- `slash` の gameplay ID、0.66秒 duration、active/contact/launch/plant/chain、damage/contact authority は変更しない。
- actor の x/z/yaw、hitbox、damage、network/save authority をモーション層から書き換えない。
- 30秒レビューは実ゲームと同じ `HumanoidRuntime` / `authored-slash` を使い、鑑賞専用の別技を作らない。
- 各バリエーションは通常 sword guard と始端・終端で連続し、既存 draw / guard / sheathe と接続可能にする。
- 数値QAは visual approval の代替にしない。

## 構造変更

1. `slash` に presentation variant を導入する。
   - `cross`: 既存v2を継承する主斬撃。
   - `return`: 逆方向へ身体を切り返す返し斬り。
   - `finisher`: 高い溜めから全身で落とす打ち下ろし。
2. variant は gameplay timing を共有し、剣軌道・骨盤/胸郭・重心・free hand・足の受けだけを変える。
3. `HumanoidRuntime` は attack の明示variantを優先し、通常プレイでは attack ID から決定論的に presentation variant を選ぶ。ゲーム判定には使わない。
4. 3 variant は初回攻撃中に都度生成せず、Shino load 時に実ランタイムの baked clip として準備する。
5. 30秒演武の17〜23秒は `cross -> return -> finisher` の一連の型として構成し、最後は十分な残心を置いて納刀へ渡す。

## 受入条件

- 3 variant が同じ guard seam と gameplay contact clock を共有する。
- contact付近の剣軌道と胴体向きが3種で明確に異なる。
- `return` は単純な腕の左右反転ではなく、骨盤・胸郭・重心を含めて切り返す。
- `finisher` は通常斬撃より高い準備姿勢と深い沈み込みを持ち、接触後に全身で制動する。
- 既存の grip/socket、forward-knee、foot plant、finite pose の回帰を壊さない。
- 30秒演武のテストは3種の順序、各beat、最終残心を固定する。
- DEVでは1xで正面・側面・斜めから、技の違いと連続性を目視確認する。
