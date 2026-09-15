# 輪廻転焦 Runtime Visual / Performance Acceptance

`apps/rinne/src/rebuild/` の100年人生runtimeは、ゲーム進行を軽くするために画質を無条件で落とす経路ではありません。Repository共通の `docs/STYLIZED_PERFORMANCE_PIPELINE.md` に従い、見えない・価値の低い負荷を削って、輪郭・動き・ライティングへ予算を戻します。

## Invariants

- 100年人生の進行、年齢、戦闘、保存、装備、村/前線遷移の意味は描画品質調整で変更しない。
- mobile-classは30 fps、desktop-classは60 fpsを目標とする。`pixel-fold-class` はsynthetic回帰基準であり、実Pixel Foldの合格証拠にはしない。
- 画質改善の根拠をFOV変更や強い照明だけで作らない。runtimeで実際に使うrenderer/materialを確認対象にする。
- 高DPI端末で固定の低いrender scaleへ常時押し込まず、アンチエイリアスを維持したうえで必要時だけ描画解像度を下げる。
- DOM HUD、保存用deep clone、敵roster再構築など、画面1フレームごとに行う必要のない処理をrender loopへ置かない。

## Regression acceptance

今回の回帰修正では少なくとも以下を満たす。

1. WebGL rendererはエッジ品質を明示的に確保し、通常品質では従来の1.35 DPR固定上限より高い有効解像度を使える。
2. frame loopはsimulation/renderを毎frame維持しつつ、HUD同期を低頻度または値変更時へ分離する。
3. `frontState` の `structuredClone` は永続化・snapshot等、コピーが必要な境界だけで行う。
4. 敵actorの生成/破棄はroster変更時だけ行い、位置・flash等の軽いvisual更新と分離する。
5. focused testで上記の品質設定とhot-loop回帰を固定し、既存gameplay/save契約を弱めない。

## DEV review

Integration後のDEVでは同じ村内経路・同じカメラ条件で、輪郭のギザつき/ぼけと移動時のframe pacingを比較する。実機性能をclaimする場合はphysical-device evidenceを別途取得し、synthetic browser結果と混同しない。
