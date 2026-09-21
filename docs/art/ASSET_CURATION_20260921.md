# 可愛い中世ファンタジー Asset 拡充 — 2026-09-21

PR #1203。`develop` を正本とし、既存の素材・ゲームキャラクター・機能を置き換えず、レビューで選択できる作者制作素材を追加する。

## 追加内容

| 配布パック | 新規実体 | 内容 |
| --- | ---: | --- |
| KayKit Medieval Hexagon 1.0 | 208 | 中世建築、生活小物、樹木・岩、六角地形、色違いの建築 |
| KayKit Dungeon Remastered 1.0 | 182 | 既存登録と重複しない建築部材、家具、装飾、生活道具、武具 |
| Quaternius Cute Animated Monsters | 19 | 丸い魔物・動物。原版の骨格と165個の専用モーションを保持 |
| Kenney RPG Audio | 32 | 扉、衣擦れ、道具・武器操作など |
| Kenney Impact Sounds | 115 | 木・石・金属等の衝撃、足音など |
| 合計 | **556** | 390静的モデル + 19体の魔物・動物 + 147音源 |

実体の合計は31,397,656 bytes（約29.94 MiB）。409モデルには実際のThree.js描画から生成したWebPサムネイルを付ける。サムネイル、ライセンス、索引の容量は上記実体合計に含めない。既存内容との重複および世界観上の除外は70件。SF寄りのAlien二種は採用しない。

テクスチャは原版モデルの材質・UVとともにGLBへ内包する。内包テクスチャを独立した新規Asset件数として水増ししない。現行307件のVFXライブラリに収録済みのEffectMaterials、および既存KayKit人型モーションは再登録しない。

## 正式登録と配信

- 配信正本: `apps/review/public/library/`。`manifest.json` の既存path/hash/bytesを維持して追記する。
- 完全な出典記録: `apps/review/public/library/provenance/curation-20260921.json`。
- 各配布パックのライセンス証拠: `apps/review/public/library/licenses/`。
- 軽量カタログデータ: `packages/assets/generated/curated-library.json`。
- 唯一の本番向けvisual registry: 既存 `packages/assets/src/visual-asset-registry.js`。別registryを新設しない。
- 選択画面: 既存 `/review-objects` と `/review-sound`。魔物・動物、検索、原版モーション選択・再生停止、素材ごとの出典表示を追加する。
- `active:true` は取り込み・読込・レビュー使用可能を表す。ゲーム内への自動配置やProduction見た目承認を意味しない。

全素材は `projectAssetUrl()` が返す自前Cloudflare Static Asset Originから取得する。作者原典・GitHub mirrorは取得および出典記録だけに使い、runtime/buildの配信元にしない。GLBには外部buffer/image URLを残さない。GLBは選択時のみ取得し、サイズ上限のあるstream読込とSHA-256照合を通してからparseする。サムネイルもlazy-loadとし、review候補一覧はスマートフォンを含め5列を維持する。

作者のgeometry、UV、材質、skin、animationを改変して似たモデルを再生成することはない。GLTF→GLB化は依存buffer/imageの埋め込みのみ。新規の魔物は人型と異なる原版骨格を使うため、専用clipをnative再生する。人型への無理なretargetや既存主人公の置き換えは行わない。

## 原典と固定revision

| 作者 | 取得repository | revision |
| --- | --- | --- |
| Kay Lousberg | `KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0` | `84fa4e91af6a88989be7c99e0891cede11f2ca38` |
| Kay Lousberg | `KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0` | `b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07` |
| Quaternius | `agentkaerf/FreeModels`（取得mirror） | `db3df04d1e4714298a09510b26fb6de6645138a2` |
| Kenney | `eturner58/game-assets`（取得mirror） | `fc2cd355a8e7c1d8e625fd650abf64f50a1fddaa` |

採用素材はすべてCC0-1.0。作者原典は以下。mirrorを作者と誤記しない。

- https://kaylousberg.com/game-assets/medieval-hexagon
- https://kaylousberg.itch.io/kaykit-dungeon-remastered
- https://quaternius.com/packs/cutemonsters.html
- https://kenney.nl/assets/rpg-audio
- https://kenney.nl/assets/impact-sounds

各実体に作者、license、原典URL、取得repository/revision/source path、原典Git blob SHA-1・SHA-256・byteLength、変換後Git blob SHA-1・SHA-256・byteLength、依存入力と変換内容を記録する。Quaterniusは作者ページのCC0宣言を取得時に検査し、宣言HTMLのSHA-256と取得mirrorの固定revisionを区別して残す。

## 検証

初回native検証はGitHub Actions run `35550870280`、チェックアウト `e49051c11b5c7fc8227a327240bc516fce3bc7fc`。WebGL2 / Three.js r186 / Chromium上で556実体と165モーションが全件合格した。素材の生成・active化後の最終merge-owning検証は別のexact-headで行い、PRにそのreceiptを紐付ける。初回証拠を後続headの合格として使い回さない。

実動作の検査内容:

- 全409モデルのGLTFLoader parse、画像decode、実描画、非空pixel、有限geometry/bounds、予算内のtriangle/texture。
- 全19体のskin/joint/index/weight/inverse bind、165clipのtrack binding・有限値・時刻ごとの骨変形、SkeletonUtils複製時の骨格独立性。
- 全147音源の実AudioContext decode、有限かつ非無音PCM、BufferSource再生。
- review上の選択・検索・pause/resume・原版clip切り替え・古い選択requestの破棄・既存樽の表示・5列モバイル表示。
- 既存人型モーションのnative/retarget適用、既存Effekseer再生、追加および既存HTML Audioの実再生。
- hash/byteLength/license/manifest/active/registryの整合性、腐敗・切断・第三者URLの拒否。

ブラウザの公開前検証は、自前Asset OriginのURLをexact-headの実体で応答させる。これは第三者runtime取得ではなく、未公開headの素材を実際に読み込むためのtransportであり、Cloudflare DEVへの公開完了を主張する証拠ではない。画面・trace・receiptのみをtask artifactに保存する。Pixel Fold実機のFPS測定や全素材のProduction美術承認はこのnative検証に含めない。

## 手動保守

以下は必要時だけ明示実行する。build、Fast DEV、常時CIには組み込まない。

```sh
python3 scripts/assets/materialize-curation.py scripts/assets/curation-20260921.json
node scripts/assets/curated-catalog.mjs
# 変更をcommitした実checkoutで、初回native検証と実サムネイルを作成:
node scripts/browser/curated-assets.mjs --generate
node scripts/assets/curated-catalog.mjs --activate .deploy-state/asset-curation-evidence/native-receipt.json
# active化結果をcommit後、最終headで全native + review回帰を検証:
node scripts/browser/curated-assets.mjs
```

一時materializer/生成workflowは最終work treeから削除する。正式なmerge-owning検証は既存Astra Work ValidationとPRに結び付くexact-head browser evidenceで行う。`main` / Productionは変更しない。

最終closeoutでは、同一実装treeに対してAstraのmerge-owning focused validationとimpact-aware freshnessを再確認し、独立したdevelop driftのみなら検証を再利用して同一PRをdevelopへmergeする。
