# @soul/characters

Character共通定義の入口です。`src/index.js` のcatalogに安定したIDで登録してください。ゲーム進行やPlatform SDKへの依存は置きません。

## Character Workshop主導の量産品質

既存MasterCharacterを拡張し、色替えだけでなく髪・顔・年齢・身体比率・衣装・役割シルエットで、同じ世界に住む別人を表現します。Shino基準個体と並行するモーション実装は維持します。

- Character Workshopで固定seedの1 / 6 / 12 / 30体、通常ゲーム距離、変更前後を比較する。検出した重複・干渉・年齢不整合を修正して再確認する。
- `Character` schema / contentVersion / genome / age / lifecycle / canonical JSONは変更しない。外見は既存データから決定論的に導出し、保存や遺伝の正本に別の乱数や世界時刻を持ち込まない。
- 既存appearance-parts v1と明示的な外見編集を受け入れる。職業は描画上の衣装・装備へ反映し、AI・戦闘・衝突・装備解禁・生活仕様を変更しない。
- 合格した共通描画をMURAAAAAAA住民と尽喰廻遊の人間NPCに接続する。近距離モデルの上限、既存軽量LOD / fallbackを維持し、全NPCを重いVRMへ置換しない。
- 個体数別のdraw calls / triangles / frame timeと共有資源を計測する。Pixel Fold実機の性能承認とソフトウェアブラウザ測定を混同しない。
- 必要な局所テスト、実ブラウザ、CI、develop Integration、DEVのsource照合を別々の証跡で記録する。main / Productionは変更しない。
