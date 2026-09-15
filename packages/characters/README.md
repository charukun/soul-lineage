# @soul/characters

Character共通定義の入口です。`src/index.js` のcatalogに安定したIDで登録してください。ゲーム進行やPlatform SDKへの依存は置きません。

## Production stage gate

キャラクターモデル制作は `docs/characters/CHARACTER_PRODUCTION_PIPELINE.md` と `src/production-pipeline.js` に従います。`REFERENCE -> BLOCKOUT -> PRIMARY -> SECONDARY -> DEFORMATION -> MOTION -> POLISH -> RUNTIME_READY` の順で証跡を積み、`packages/characters/production/*.production.json` を正本にします。

Three.js primitives / runtime procedural geometryは確認用の `BLOCKOUT` までです。見た目が表示できる、共通リグで動く、Visual Review Labに載る、という事実だけでproduction/game-readyへ昇格させません。`PRIMARY` 以降はDCC（Blender優先、Maya可）またはprovenance確認済みimport meshを必要とし、最終昇格には変形、Motion QA、明示Visual Approval、WebGL2とDesktop/Pixel Fold級実測を要求します。

`npm run characters:production:check` はcatalogとproduction manifestの誤分類をfail closedで検出します。Astra/実装Workerはキャラクター作業前にこの契約を読み、現在stageを報告してください。

## Character Workshop主導の量産品質

既存MasterCharacterを拡張し、色替えだけでなく髪・顔・年齢・身体比率・衣装・役割シルエットで、同じ世界に住む別人を表現します。Shino基準個体と並行するモーション実装は維持します。

- Character Workshopで固定seedの1 / 6 / 12 / 30体、通常ゲーム距離、変更前後を比較する。検出した重複・干渉・年齢不整合を修正して再確認する。
- `Character` schema / contentVersion / genome / age / lifecycle / canonical JSONは変更しない。外見は既存データから決定論的に導出し、保存や遺伝の正本に別の乱数や世界時刻を持ち込まない。
- 既存appearance-parts v1と明示的な外見編集を受け入れる。職業は描画上の衣装・装備へ反映し、AI・戦闘・衝突・装備解禁・生活仕様を変更しない。
- 合格した共通描画をMURAAAAAAA住民と尽喰廻遊の人間NPCに接続する。近距離モデルの上限、既存軽量LOD / fallbackを維持し、全NPCを重いVRMへ置換しない。
- 個体数別のdraw calls / triangles / frame timeと共有資源を計測する。Pixel Fold実機の性能承認とソフトウェアブラウザ測定を混同しない。
- 必要な局所テスト、実ブラウザ、CI、develop Integration、DEVのsource照合を別々の証跡で記録する。main / Productionは変更しない。

## Character presentation resolution

3アプリは人物の保存・遺伝・年齢を共有Character契約で扱い、見た目の選択だけを描画ポリシーとして解決します。解決順序は `Character -> Body Archetype -> Role Appearance -> Render Tier -> Production Asset` とし、アプリ固有ゲームロジックや保存形式をこの層へ持ち込みません。

- Body Archetypeは年齢と既存body appearanceから決定論的に導出し、Character schemaへ新しい永続フィールドを追加しない。
- Role Appearanceは職業・役割の見た目だけを選び、AI・戦闘・衝突・装備解禁を変更しない。
- Render Tierは既存`crowdPlan()`の`full / mid / far / hidden`を正本とし、距離や重要度で重い表現を制限する。
- Production Assetはproduction manifestとcatalogの状態を尊重し、`BLOCKOUT`参照モデルを完成品として自動採用しない。
- 輪廻転焦・MURAAAAAAA・尽喰廻遊は同じ人間表現基盤を利用できるが、人物IDそのものをアプリ間で同一人物と仮定しない。
