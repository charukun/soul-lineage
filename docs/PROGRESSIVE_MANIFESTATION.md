# Progressive Manifestation

3アプリ共通の「初回ローディングを顕現演出へ変える」描画契約。

## 目的

- モデルや高品質表示資産を全件先読みせず、必要になりそうな対象を低優先度で先読みし、プレイヤーが注目した対象を最優先へ昇格する。
- ロード待ちをスピナーや停止として見せず、気配・仮像・形成・顕現というゲーム内表現へ変換する。
- ゲーム状態・当たり判定・AI・戦闘結果・同期authorityはロード完了と分離し、通信速度や端末性能をゲーム性能にしない。
- 一度完成した対象は視線が外れても低解像度へ戻さない。メモリ退避や再取得は裏側の資源管理として扱う。

## 状態

`dormant -> hinted -> loading -> forming -> manifested`

- `dormant`: 未要求。ゲーム状態は存在してよい。
- `hinted`: 画面内・接近・出現予告などで先読み候補になった状態。低優先度。
- `loading`: 注目、戦闘、会話、操作対象などで優先度を上げて資産取得中。
- `forming`: 完成資産が利用可能になり、仮像から本モデルへ顕現中。
- `manifested`: 完成本体。以後は同一セッション内で表示解像度を戻さない。

ロード失敗時は既存fallbackを維持し、ゲーム進行を止めない。

## 注目優先度

注目は描画・通信の意味論ではなく、初回資産取得の優先度入力として扱う。

優先度例:
1. 現在の戦闘・会話・操作対象
2. 画面中央で一定時間注視している対象
3. 画面内かつ近距離の対象
4. 画面外だが近く出現予定の対象
5. その他の候補

同時ロード数には上限を持ち、既に開始した重要ロードを低重要対象のために中断しない。

## 顕現

顕現VFXは共通profileで制御し、対象の性質に合わせて強度・粒子・揺らぎ・衝撃・形成速度を変える。

- `human`: 穏やかな輪郭形成、光粒子中心。
- `hostile`: 鋭い発光、速い形成、短い衝撃。
- `massive`: 重い立ち上がり、強い衝撃、遅めの形成。
- `shadow`: 黒煙・揺らぎ寄り、衝撃は弱め。
- `swarm`: 細かい粒子と分散収束。
- `subtle`: 背景対象向け。派手な画面占有を避ける。

VFX自体にも品質scaleを適用し、ロード軽量化をVFX負荷で打ち消さない。

## 共通基盤

`@soul/rendering/progressive-manifestation` が以下を所有する。

- priority queue / 最大同時ロード数
- monotonic state transition
- progress通知
- attention / prefetch priority更新
- stream読取のprogress helper
- manifestation profile / visual phase
- failure / fallback receipt

各appはゲーム固有の対象選択、placeholder、完成モデルの接続だけをadapterで所有する。

## 初期適用

- Rinne: KayKitキャラクター資産の初回準備と、未使用variantの段階先読み。
- Village: humanoid actorの顕現状態を共通契約へ接続し、将来model-backed residentへ同じ経路を使えるようにする。
- Demon: Gobkit怪物の外部GLB取得をprogressive loaderへ移し、怪物種別ごとに顕現profileを変える。

## 受入条件

- 3アプリが同じprogressive manifestation契約を参照する。
- 注目対象が非注目候補より高優先度でロードされる。
- 同一対象の表示状態は `manifested` 後に低解像度状態へ戻らない。
- 資産ロード失敗でもゲーム状態と既存fallbackは継続する。
- DemonのGobkit取得はbytes progressを記録できる。
- 顕現profileはモデル性質ごとに変更可能で、共通VFX品質scaleを持つ。
- 局所テストでpriority、状態遷移、concurrency、failure fallbackを検証する。
