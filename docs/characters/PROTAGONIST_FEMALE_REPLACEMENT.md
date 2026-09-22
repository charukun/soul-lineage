# 女主人公の外部モデル差し替え

2026-09-22: ユーザーの明示的な破棄依頼により、旧自作モデルを廃止。

## 採用原本

Kay Lousberg / KayKit Adventurers 1.0 / Rogue（フードなし）。
CC0-1.0 の公式 GLB を無改変で保持。顔・髪・服を自作で置き換えない。

正本は `apps/review/public/library/provenance/female-protagonist-rogue-v1.json`。
原典 URL・固定 revision・作者・ライセンス・Git blob SHA・SHA-256・byte length を記録。
原本 3,616,284 bytes、SHA-256 は
`e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d`。
実体は `apps/review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb`。
通常表示は `projectAssetUrl` による自前 Cloudflare Asset Origin を利用し、第三者 URL を runtime 参照しない。

## 旧モデルの破棄と互換性

`protagonist.villager.female.v1` は既存の選択 ID としてだけ継続する。
旧 SHA-256 `7c422960add80f120d5dbcd91a6b74e23269b35049796f60cb1e6c4e4604d9a2` の
GLB、Blender 原本、再生成スクリプト、旧参照画、旧 QA 画像は現行ツリーから除去。
履歴は Git に残るが active 候補でも fallback でもない。

公式原本に同梱された武器見本 5 メッシュは、女主人公の表示時だけ外す。
対象は `Knife_Offhand`, `1H_Crossbow`, `2H_Crossbow`, `Knife`, `Throwable`。
身体・髪・衣装・Rig・手持ちソケットは残し、GLB 原本そのものは変更しない。
モデル鑑賞とゲーム上の装備所有を混同しない。
男主人公、セーブ、年齢・成長、戦闘ルール、装備所有、共通リグ契約は変更しない。

## 実表示 Observation

観察した実装 SHA: `3263bdc6f09a1724de14165bf2cfcb21f6aa68a7`。
実行: GitHub Actions run `35679442674`、artifact `10674140794`。
実際の Character Studio を `APP_ENV=dev` で build し、同一 checkout の
取得済み原本を自前 origin のローカル代替として読み込んだ。公開 DEV の表示確認ではない。

正面、斜め、横、背面、顔アップ、首回転・右肩/肘・左膝の変形ポーズ、
390px 幅の表示を取得し、画像を目視確認した。
初回に武器見本の同時表示を発見し、表示対象のみを修正して再取得した。
原作者の顔・髪・服、手持ちソケットは維持。モデルロード監査は通過し、
最終 receipt の page error / HTTP error / console error はいずれも空。

これは実 GLB の表示と限定した関節変形の確認であり、全モーションの品質保証や
Pixel Fold 実機の性能計測ではない。生モデルの T-pose は検査表示として維持する。
CI の日本語フォント表示と画面下のカメラ操作列はモデル造形の評価に含めない。
旧モデルの PRIMARY 段階・視覚証拠は継承せず、新規採用モデルは REFERENCE、
`visualApproval=pending` / `productionReady=false` を維持する。

この観察後の最終コミットでは、実モデルと表示ロジックはそのままに、
一時取得・観察 workflow/scripts を除去し、モジュール参照の回帰テストを追加する。
恒久 CI の拡張や品質ゲートの緩和は行わない。
