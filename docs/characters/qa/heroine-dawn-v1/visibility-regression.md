# 女主人公の顔・手足が消える保存状態の回帰修復

PR #1435。2026-09-22、#1417反映後にユーザーが提示した公開Character Studioの「髪と緑の服だけが残る」スクリーンショットを受けた修復。

## 原因と変更

初期状態のブラウザでは正しく表示される一方、既存の髪型・服パーツが保存されている場合に、実モデル専用カタログにも旧modular editorのcontrollerが取り付いていた。カタログはworkspace.selectModelを経ずに実モデルをロードするため、workspace側のDCC判定だけではその混在を防げなかった。

さらに、主人公の共通material `HeroineDawn_SoftClothAndHair` を名前のHAIR部分だけで髪専用と判定していた。保存済みの `hair: tail` 等で元の髪を隠す処理が、顔・手足を含む全19実モデル面を非表示にした。残っていた髪と緑の服は旧editorが生成した部品であり、新しい主人公の実メッシュではなかった。

修復は実モデル専用カタログへmodular部品を適用しないこと、および複数部位を含む共有materialを単一部位と誤認して非表示・着色しないことの2点。専用HAIR/SKIN/CLOTH/EyeIrisの既存挙動は維持する。advanced editorの保存内容・個体情報は削除せず、カタログ表示と分離する。

女主人公GLB、Blender正本、rig、animation、原本Rogueは一切変更しない。キャッシュや保存データの削除を修復手段としない。

## 実ブラウザによる再現と修正確認

成功したspecialist observation: [GitHub Actions run 35691968951](https://github.com/charukun/soul-lineage/actions/runs/35691968951)。

Exact checkout: `c65150d38b079214771a3ee1ff9ebef6d489ba9f`。
Artifact: [10679371568](https://github.com/charukun/soul-lineage/actions/runs/35691968951/artifacts/10679371568)、名前 `heroine-visibility-c65150d38b079214771a3ee1ff9ebef6d489ba9f`。
ZIP SHA-256: `e1146dda9d5563e9932b2ab74b85f63b9d913d1bae3dc0a2d06356196abb3ada`。Task artifactの保持期限は2026-09-29。結果・画像は会話にも保存している。

Beforeはcanonical public rootを実際に取得し、version.jsonのcommitが `218802bf9689aa35633a03c4f17b719ca978db01` と確認。responseの差し替えなし。Afterはhosted runnerでbuildした本物の `dist/character-studio` をHTTP配信し、自前Origin用の同一checkout内asset実体を読み込んだ。

両者へ同一の有効な保存workspaceを投入した。ユーザー端末の保存データそのものを取得したとは主張せず、実serializerで生成した再現fixtureを使用する。fixtureは `hair: tail / outfit: tunic / quality.reference: false` を含み、SHA-256は `5e6f697ae6dc176295789c8f8a9fde454eb6d7a5b500e7e8c8b89c39044c7301`。

Before/AfterともGLB SHA-256は `777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678`。Beforeでは全19面非表示と旧部品だけが残ることをassertし、画像でも再現を確認した。Afterでは全19面が可視・不透明・元色で、旧部品やmodular controllerが混ざらないことをassertし、実画像を目視確認した。

Afterの9状態: 正面、横、背面、顔、スマホ全身、Rogue切替、女主人公へ戻す、再読込後の再選択、desktop全身斜め。393px幅/DPR2/touchのcontextを使い、既存のカードと可視cameraボタンを実クリックした。試験からvisibilityやconfigureを直したり、保存を消したり、非表示ボタンをforce-clickしていない。

個体records・編集parts・localStorage内partsが維持されることも各状態で確認。page/console errorsはBefore/Afterとも0件。artifact内の `result.json`、`before/receipt.json`、`after/receipt.json` と各PNG/JSONが根拠。

## 回帰試験と最終head

専用materialの既存挙動、混在atlasの誤分類防止、実pool＋modular controllerによる可視性・色・reset、既存master pool/modular/workspace、女主人公の原本・rig・animation互換について、specialist runでは26 testsが成功した。Character Studio buildも成功した。

最終merge-owning validationは一時workflowと診断実行スクリプトを除去し、最新developを同一branchへ取り込んだ新しいexact headで別途行う。修復したruntime/helper/browser regressionのblobは上記成功runから変更せず、共有renderingの利用先であるRINNE buildも選択する。最終head・validation run・merge receiptはPRに記録する。

このbounded browser regressionは明示的な視覚修復タスク用であり、通常Astra focused laneへChromiumを追加しない。実機Pixel Foldの性能計測、公開後のDEV完了確認、全装備・全clipの総当たり保証、人間のvisualApprovalを意味しない。main/Productionは変更しない。
