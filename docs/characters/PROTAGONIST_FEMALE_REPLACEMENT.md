# 女主人公 — Rogueから独立したDCC派生モデル

2026-09-22の追加依頼「盗賊と同一人物にしか見えない」を受け、`protagonist.villager.female.v1` を主人公専用の実モデルへ更新した。同日先行対応の「公式Rogueを無改変で採用」は比較用の原本として残すが、女主人公のactive出力ではなくなった。

## 現在の採用モデル

名称はHeroine Dawn。丸い短めの栗色ボブ、大きく流した前髪、小さなローズ色の髪飾り、生成りの襟と袖、明るい青の村人服、細い帯と背面リボンを持つ。元の長いケープ・三角スカーフ・重い革ベルト・ポーチ・耳飾りを除去。髪型、首・肩周り、裾、背面の輪郭を実メッシュで変え、単なる配色違いにしない。

KayKit原本の顔・手足を制作上の基礎とし、眉・目の印象を調整。破棄済みの旧自作頭部は再導入しない。元のRig_Medium、41関節、inverse bind、76 animation sampler streamsはbyte-for-byteで保持する。

採用出力・作者・CC0ライセンス・固定原典revision・hash・byte lengthの正本は `apps/review/public/library/provenance/heroine-dawn-v1.json`。編集正本は `assets/characters/heroine-dawn/source/HeroineDawn.blend`。再構成手順は同ディレクトリのREADMEを参照。

実体は自前Cloudflare Static Asset Origin配下のcontent-addressed GLBとして収録する。通常runtimeから上流GitHubへ直接アクセスしない。RINNEとCharacter Studioのfemale integrity receiptは同じ採用binaryを指す。

## 制作と実表示の確認

Blenderで3ラウンドの実編集・実レンダーを行った。第1稿の衣装の穴と角張った前髪を第2稿で修正し、実Character Studioの歩行で見つかった裾の短パン貫通を第3稿で修正した。

最終出力を実Character Studioで読み込み、正面・斜め・横・背面・顔アップ、390px幅、待機・歩行2位相・攻撃・防御・被弾を取得して画像を目視確認した。これは実GLBの表示証拠であり、生成イラストではない。実画像、観察条件、出力hash、変形結果は `docs/characters/qa/heroine-dawn-v1/README.md` と `runtime/receipt.json` に記録している。

## 維持する境界

旧SHA-256 `7c422960add80f120d5dbcd91a6b74e23269b35049796f60cb1e6c4e4604d9a2` の自作GLB・Blender原本・再生成スクリプト・参照画は廃止したまま。今回の派生は固定CC0 Rogueから始めた別の制作物であり、その旧モデルへfallbackしない。

公式Rogue原本のSHA-256 `e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d` は変更しない。Rogue自身は独立した盗賊候補のまま。女主人公の表示時に同梱武器見本5メッシュを外す既存設定は継続し、装備所有や手持ちソケットを変えない。

男主人公、通常プレイの主人公選択方式、セーブ、年齢・成長、操作、戦闘、装備所有は変更しない。制作段階はPRIMARY、`visualApproval=pending` / `productionReady=false`。実表示の目視確認を人間の最終承認や全76クリップ・全装備の品質保証、Pixel Fold実機の性能計測に読み替えない。main / Productionへの反映は対象外。
