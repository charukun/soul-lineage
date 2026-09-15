# Growth Model Review

## Purpose

Visual Review Lab に、同一人物の成長を世界時間で連続確認する専用ページを追加する。通常のモーション確認とは分離し、ゲーム保存・寿命・Production stage・visualApprovalを変更しない。

## UX

- Lab右上に「成長」ボタンを置き、`growth-review.html`へ移動する。
- 成長ページ内でもモデルを選択できる。Labの実キャラ確認対象に加えて KayKit Motion Library の Knight / Barbarian / Mage / Rogue / Rogue Hooded を切り替える。
- 0〜90歳を既存LifeClockの `secondsPerYear=60` に合わせ、世界時間 0〜5400秒のシークバーで確認する。
- 現在年齢、成長段階、世界時間、身長比、頭身補正、白髪度、前傾、肌年齢を表示する。
- 4 / 12 / 22 / 50 / 75歳へ即移動できる固定probeを用意する。
- 正面・斜め・横・背面・顔の固定視点を用意する。
- 選択モデルと年齢はURL queryへ保持し、同じ比較状態を再現できる。
- 色・余白・タイポグラフィ・モデルpickerは既存Visual Review Labに合わせる。

## Model behavior

既存 `public/simulator/src/life-clock.js` の `appearanceForAge()` を唯一の年齢カーブとして使う。各選択モデルに対して全体scale、頭部scale、加齢前傾、髪の白髪化、顔skinの加齢補正をレビュー専用に適用する。SHINOの細身・がっしり・小柄は既存LabのappearanceScaleを維持したまま同じ年齢カーブを重ねる。

KayKit Adventurers は VRM metadata を持たないため、共有 `Rig_Medium` の実bone名 (`hips`, `spine`, `chest`, `head`, `upperarm*`, `lowerarm*`, `upperleg*`, `lowerleg*`) を fail-closed で解決する低ポリ専用aging adapterを使う。幼少期は全身scaleだけでなく頭部を相対的に大きくし、老年期はspine/chest/headへ前傾を適用する。髪・髭・眉など年齢対象のmeshが独立している場合はmaterialをモデル単位でcloneして白髪化し、共有material全体を灰色にして服や肌まで変色させない。face/skin meshを安全に分離できる場合だけ軽い肌年齢補正を行う。

KayKitのagingは「別年代の専用DCC meshが完成した」という主張ではない。同じ低ポリ人物のrig/proportion/materialを年齢に応じて変化させるreview/runtime表現であり、専用生成モデルが追加されたら同じ世界時間UIへ差し替えられる。

将来、幼少 / 少年 / 青年 / 壮年 / 老年の専用生成モデルが追加された場合も、このページの世界時間UIと固定probeを維持したままモデル供給側を差し替えられるよう、表示制御とasset選択を分離する。

## Acceptance

- KayKit 5モデルすべてが成長ページのpickerに出る。
- KayKitの選択状態でも 0〜90歳シーク、5固定probe、5方向view が維持される。
- KayKitの `Rig_Medium` 必須boneが不足する場合は無言fallbackせず読込エラーにする。
- 4歳では22歳より相対的に頭が大きく、75歳では22歳より前傾・加齢指標が増える。
- model切替で年齢・viewを失わず、URL queryから復元できる。
- このレビューだけでProduction stage / visualApprovalを変更しない。

## Boundaries

- main / Production変更なし。
- Visual Review Labの独立Draft運用を維持。
- ゲーム保存、遺伝、戦闘、装備、寿命ルールを変更しない。
- このページの表示結果だけでProduction stageまたはvisualApprovalを昇格しない。
