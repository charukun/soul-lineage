# 30秒演武 dynamic recovery

## 背景

PR #630 の初稿では `cross / return / finisher` の見た目差を増やすため、`shino-slash-2` から派生した presentation variant を導入した。しかしユーザー確認では、前版のしのちゃんにあった大きな重心移動・踏み込み・振り抜きの連続感より、技の分類と静止区間が目立ち、演武として明確な退行になった。

この修正では variant 方式を30秒演武と通常runtimeから撤回し、最新 `develop` の `shino-slash-2` を動的品質の基準としてそのまま使う。改善対象は単発斬撃の形ではなく、17〜23秒をどう途切れず繋ぐかに戻す。

## 不変条件

- `authored-slash.js` は最新 `develop` の `shino-slash-2` をそのまま使用する。
- `slash` の 0.66秒 duration、active/contact/launch/plant/chain、hit/damage/gameplay authority は変更しない。
- 30秒review専用の別ポーズ、別skill、別gameplay clockは作らない。
- actorのworld transform authorityをモーションQAへ移さない。
- Numeric QAや簡易棒人間プレビューを visual approval の代用にしない。

## 17〜23秒の新しい演武

6秒を空白なく次の実runtime状態で埋める。

| local time | state | intent |
| --- | --- | --- |
| 0.00–0.28 | run-speed surge | 最初から止まらず踏み込む |
| 0.28–0.94 | `shino-slash-2` | 第1撃。既存の低い溜めと大きい前進を維持 |
| 0.94–1.18 | lateral rebound | 振り抜きの勢いを足で受け、次へ切り返す |
| 1.18–1.48 | runtime parry | 静止guardではなく受け動作で方向転換 |
| 1.48–2.14 | `shino-slash-2` | 第2撃 |
| 2.14–2.40 | diagonal drive | 走り速度で間合いを詰め直す |
| 2.40–3.06 | `shino-slash-2` | 第3撃 |
| 3.06–3.32 | opposite cutover | 逆方向へ足を切り返す |
| 3.32–3.98 | `shino-slash-2` | 第4撃 |
| 3.98–4.30 | charge | 最終撃へもう一度加速 |
| 4.30–4.96 | `shino-slash-2` | 第5撃 |
| 4.96–5.24 | braking step | 全身で勢いを受ける |
| 5.24–6.00 | runtime zanshin | 0.76秒だけ残心を置き納刀へ渡す |

## 受入条件

- 17〜23秒にdead guard gapを作らない。120Hzサンプルで全区間がいずれかの実runtime状態に属すること。
- 斬撃は前版の `shino-slash-2` を5回そのまま使用し、variant変形を掛けないこと。
- 少なくとも1区間はrun閾値を超える速度、左右両方向の切り返し、既存parry、既存zanshinを含むこと。
- 既存の低重心、骨盤/胸郭逆捻り、前方release、free hand、全身brakingの回帰を維持すること。
- 実Shinoの1x WebGL確認では、棒人間や数値ではなく、踏み込み→斬撃→切り返し→受け→連撃→制動→残心が一続きに読めることを確認する。
