# P3 部位・スタミナ・勝敗の実接続

基点: develop@8727120b1920da1650cb1a417f5bb829d0acdb56。

- `combat-choreography.js` と `combat-injury.js` の実装を共有packageへ移し、旧側は同じ関数の再exportとした。部位の式・phase別上限・行動不能条件を再定義しない。
- staminaの消費・回復・四段階policyも共有。人生時計の所有権と技能によるcost修正は本編側に残す。
- `/battle2?johakyu=p3` は原型モーションへ部位・スタミナを接続するreview encounter。native側はdamageを二重適用しない。
- 一命中のidentityはbattle内のattack/source/targetで管理し、event IDを変えた再通知も再適用しない。HPを削り切っただけでは健康な部位を戦闘不能としない。
- 腕・脚の負傷が実際の攻撃力・移動速度へ作用する。観測値は実際の六部位とstaminaに一致する。可愛いモデルの欠損・変形は追加しない。
- 通常`/battle2`、P2、bk、カメラ・素材・音・描画blockは維持。P0 manifestを新hashで上書きしない。
- 前PRの単独関数と完了markerはP7受入の証拠ではない。本編通常操作・保存・実機性能は後続の接続・検証対象。

正式検証は本PRのexact-head Actions結果を参照。この文書やローカルpreflightだけを成功証拠としない。
