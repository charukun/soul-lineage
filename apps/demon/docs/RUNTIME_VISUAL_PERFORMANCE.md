# 尽喰廻遊 Runtime Visual / Performance Acceptance

Pixel Fold級の高DPIスマホでは、3Dキャンバスだけが低内部解像度で拡大されたように見える状態を許容しない。Repository共通のmobile 30fps方針を維持しつつ、画質低下より先に不要なCPU走査・低価値なvisual workを削る。

## Invariants

- 狩り、戦闘、捕食、保存、転生史、村生成、Tidebreakの判定を描画品質調整で変更しない。
- WebGL MSAAを維持し、高DPI端末では通常品質の実効pixel ratioを1.35固定相当へ常時押し込まない。
- adaptive qualityは持続的な負荷に対してのみ段階的に働き、最低品質でもプレイヤー・敵・目的地点の輪郭可読性を優先する。
- texture quality、stylized shader installation、texture budget監査、transparency監査など全scene traversalを毎frame実行しない。
- per-frameに必要なのはsimulation/render、軽量なactor visual update、GPU timing/streaming等に限定し、重い監査はquality変更・scene変更・低頻度samplingへ移す。
- synthetic `pixel-fold-class` は回帰基準であり、実Pixel Foldの性能合格証拠とは扱わない。

## Regression acceptance

1. DPR 2以上の端末ではfull/balanced/mobile/survivalの各段階で、既存の1.5×renderScaleより高い実効解像度を維持し、survivalでも無条件に1.02付近まで落とさない。
2. quality snapshotが変化していないframeでは、scene-wide texture/shader/budget traversalを繰り返さない。
3. scene buildやcharacter load後には必要なquality/material設定を再適用する。
4. performance telemetry、GPU timing、thermal governor、streaming/occlusionの既存診断を保持する。
5. focused regression testでpixel ratio floorとhot-loop境界を固定する。

## DEV review

同じ狩場・同じカメラ・同じPixel Fold級端末で、3D部分の輪郭/石畳/人物シルエットのぼけと移動時frame pacingを比較する。UI文字だけが鮮明で3Dキャンバスだけが低解像度に見える状態を不合格とする。
