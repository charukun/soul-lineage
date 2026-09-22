# Heroine Dawn — 女主人公の編集可能な実モデル

`protagonist.villager.female.v1` 専用の KayKit CC0 派生モデル。Rogue原本とリグは残し、主人公用の髪・服・シルエットを Blender で編集した。過去に破棄された自作の顔モデルを復活させたものではない。

## 正本と出力

- 編集正本: `source/HeroineDawn.blend`。テクスチャはpack済みで、Rig_Mediumと編集可能な各メッシュを含む。
- パレット: `source/HeroineDawnPalette.png`。
- 採用GLBのcontent-addressed path、hash、byte length、原作者、原典revision、CC0 license: `apps/review/public/library/provenance/heroine-dawn-v1.json`。
- 実表示・変形・比較画像: `docs/characters/qa/heroine-dawn-v1/`。

原本は `apps/review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb`。SHA-256は `e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d`。原本は上書きしない。

## 再構成

制作・観察に使用したBlenderは4.0.2、PythonにはNumPyが必要。以下をrepository rootで実行する。作業用の出力先を指定し、採用済みsourceを直接上書きしない。

```sh
SRC=apps/review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb
DCC=assets/characters/heroine-dawn
OUT=/tmp/rinne-heroine-dawn
blender --background --python-exit-code 1 --python "$DCC/build.py" -- --source "$SRC" --out "$OUT/round1"
blender --background "$OUT/round1/HeroineDawn.blend" --python-exit-code 1 --python "$DCC/finalize.py" -- --source "$SRC" --out "$OUT/round2"
blender --background "$OUT/round2/HeroineDawn.blend" --python-exit-code 1 --python "$DCC/polish.py" -- --source "$SRC" --out "$OUT/round3"
```

`polish.py` の入力は必ず第2稿。採用済み第3稿へ再度適用すると裾を二重に広げてしまうため、直接適用しない。Blenderファイルの保存時メタデータまで決定的な再生成を保証するものではなく、採用済みbinaryのhashはprovenanceを正本とする。

`build.py` が実原本を取り込み、頭髪・盗賊小物の該当面を分離し、主人公の髪と服を制作する。`finalize.py` / `refine.py` が連続した服面、元の身体から転送したskin weight、髪の曲面と法線を修正する。`polish.py` は実際の歩行表示で見つかった裾の貫通に対して、服の外形へ余裕を追加する。

`dcc_glb.py` は実際のBlenderメッシュからgeometry/UV/weightを読み出す。原本の41関節の名前・階層・bind情報と76クリップのsampler payloadは保持し、無変更をassertする。通常の再サンプリングexportで既存クリップを書き換えない。

## 運用上の境界

通常runtimeは自前Cloudflare Asset OriginのGLBだけを参照し、上流GitHubから直接配信しない。変更時は新しいhash pathへ収録し、RINNEとCharacter Studioのintegrity receipt、catalog、provenanceを一緒に更新する。

今回のBlender/Playwright runnerはユーザーが明示した実編集・実観察のためだけの一時経路であり、最終merge前にworkflowと搬送・観察用スクリプトを除去する。常設のCI/build/gateへDCCやbrowserを追加しない。ここに残すのは編集正本と再構成recipeのみ。

PRIMARYは編集段階の記録であって人間の最終承認ではない。`visualApproval=pending`、`productionReady=false`、実機性能未計測を維持する。男主人公、既存セーブ、操作、戦闘、装備所有、通常プレイの主人公選択ルールを変更するモデル制作ではない。
