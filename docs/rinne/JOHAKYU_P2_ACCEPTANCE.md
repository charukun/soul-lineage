# 序破急 P2: 編成・意識と現行モーションの接続

実装基点: `d350d6eb22229da12aa1e90c8bd62bd9feb4cbad`。最新develop `ff651afb4aa965b5b85c027394cd8d660bd59a0b` を競合なしで取り込む。
P1はPR #1192でdevelopへ統合済み。検証head `079817f5bb521a353d58ed0c71381896b40f645a`、Actions run `35544975158`。同じP1更新後ソースを今回のBeforeとする。

## 機能範囲

`/battle2?johakyu=p2` は段階統合を確認するreview encounter。通常の `/battle2` は受入済みの原型挙動を保つ。`mind=aggressive|patient|counter|evasive` で同じ六軸の意識契約を使用する。queryの変更は本編の保存・習得・装備変更ではない。

旧 `tidebreak-loadout.js` の原型・行動の表と、旧 `combat-choreography.js` の意識正規化を `@soul/game-data` に移し、旧側も同じ定義を参照する。app間importやTidebreak描画器の持込みは行わない。

各phaseの編成は実際の三段の実行を所有する。攻撃instanceが完了してから次へ進み、重複completionや中断をphase進行として数えない。反撃の受けは独立したreactionで、正式な技の習得や新しい連を捏造しない。

モデル・待機・カメラ・照明・霧・素材・描画関数・音の原型を保持し、現在のclipへ命令を接続する。未対応武器、未登録技、未対応のchargeは拒否する。現段階のmotion bindingは片手剣で受入対象を限定し、P4の全武器対応完了とはしない。

## 検証範囲

正式な受入はPRのexact-headに紐付いたGitHub Actionsの結果を参照する。この文書自体は成功の証拠ではない。

- native無効接続とBKとの120秒の戦闘結果・乱数・音の一致。
- 現行rendererの保護ブロック、素材・backup・元依存の同一性。
- 序→破→急の実行、意識による実軌跡・被害差、実モデルに存在するclip、一命中一event。
- 旧側の共有後の意識・部位・装備slot契約、およびreview/rinneのbuild。
- 既存 `apps/review/scripts/nocturne-browser.mjs` によるexact-headのブラウザ表示。`BEFORE_ROOT` と `BEFORE_SOURCE_SHA` を指定した固定ソースのBeforeを要求する。mutable DEVの画像を比較基準にしない。

ブラウザのソフトウェア描画やviewportは実端末FPSの証明ではない。Beforeの制御advanceとAfterの通常再生は経過時刻も記録し、ピクセル完全一致とは主張しない。P7の長時間・端末・本編通常操作の受入は別途必要。

## 残る境界

このreview encounterのHP・一対一・リセットは検査用。P3の六部位・スタミナ、P4の習得・全武器、P5の遭遇と本編操作、P6の人生・保存は未統合。最終既定切替はP7の受入後。P1台帳の候補全開放という記述は旧文書の記録であり、最新のinspiration/legacy保存検証と心slot装着の実装を迂回する根拠にしない。
