# 演舞レビュー入口

RINNE のキャラクターモーション確認は、`apps/rinne/characters.html` の「演舞レビュー」を正本とする。

## 役割

- 30秒演舞、モーション選択、再生速度、コマ送り、カメラ、補正前後比較、Motion QA 記録を同じ入口から行う。
- 技単体の確認は正本ページから辿れる補助デバッグとして扱い、利用者向けに別の「演舞ページ」が存在するようには見せない。
- 旧 `apps/rinne/public/simulator/motion-review.html` は互換URLとして正本へ案内し、新しい確認機能を追加しない。

## 受入条件

- キャラクター工房のモーション確認名称を「演舞レビュー」に統一する。
- 30秒演舞の主導線は正本ページだけに置く。
- 旧斬撃レビューURLを直接開いても正本ページへ戻れる。
- 本編保存、ゲーム状態、既存Motion QAデータ形式には影響しない。

## 外部モーション追加の契約

- 実モーションの正本は、出典repository・固定revision・source path・上流clip名/index・作者・license・immutable hashを持つsource registryとする。
- 同じ上流clipの速度、鏡像、切り出し、ループ、root motion、retarget先、形式変換の差を追加数へ算入しない。モデル別の埋め込みコピーも重複除外する。
- 「すべて」から全登録source motionを個別に選択でき、MOTION CLIPSの表示値を同じregistryから動的に算出する。
- manifestは軽量に保ち、animation binaryは選択時に読み込みsource単位でcacheする。既存の再生操作と30秒演舞・Motion QA導線を維持する。
- 追加前後のunique件数、重複除外、出典・除外理由、再生検証のevidenceを記録する。再生できないclipを追加済みとして数えない。
