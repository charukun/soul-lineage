# 女主人公の外部モデル差し替え

2026-09-22: ユーザーの明示的な破棄依頼により、旧自作モデルを廃止。

採用: Kay Lousberg / KayKit Adventurers 1.0 / Rogue（フードなし）。
CC0-1.0の公式GLBを無改変で保持。顔・髪・服を自作で置き換えない。

正本は `apps/review/public/library/provenance/female-protagonist-rogue-v1.json`。
Git blob / SHA-256 / bytes / 原典URL / revision / ライセンスを固定。
モデル実体は同監査票の `path` にあり、自前Cloudflare Asset Originから配信。

`protagonist.villager.female.v1` は選択互換IDとしてだけ継続する。
旧SHA-256 `7c422960add80f120d5dbcd91a6b74e23269b35049796f60cb1e6c4e4604d9a2` の
GLB、Blender原本、再生成スクリプト、旧参照画、旧QA画像は現行ツリーから除去。
履歴はGitに残るがactive候補でもfallbackでもない。

旧PRIMARYと旧視覚証拠は継承しない。新規採用モデルはREFERENCE、
visualApproval=pending / productionReady=false。男主人公、セーブ、成長、
戦闘、装備所有、共通リグ・ソケット契約は変更しない。
