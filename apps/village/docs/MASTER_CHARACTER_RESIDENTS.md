# MURAAAAAAA量産住民モデル統合

Sendagaya_ShinoをMasterCharacter正本として、村の近距離住民へ量産モデルを実投入する。

## 実施範囲

- 既存の住民シミュレーション、年齢、役割、移動、生活、1000人規模の集約LODは変更しない。
- 近距離かつ人型の詳細住民だけをMasterCharacter描画へ置き換える。
- 遠距離住民、動物、魔物、ロード失敗時は既存の軽量モデルを維持する。
- 個体差は住民ID/seedから決定論的に生成し、年齢は既存world stateをMasterCharacterのappearanceへ写像する。
- 同一VRMのGeometry/Textureを共有し、上限付きpoolで描画負荷を制御する。
- まず実機負荷を抑える保守的な近距離上限で導入し、Pixel Fold確認後に必要なら上限を調整する。

## 受入条件

- 既存の村セーブ、シミュレーション、住民選択、当たり判定、移動、LODを壊さない。
- MasterCharacter取得・監査・初期化失敗時も村は既存モデルで継続できる。
- 同一住民は再読み込み後も同じ外見seedになる。
- main / Productionは変更しない。
