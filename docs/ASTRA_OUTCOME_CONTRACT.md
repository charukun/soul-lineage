# Astra Outcome Contract

輪廻転焦の実装 worker は、固定手順を消化する operator ではなく、現在の `develop` とユーザー意図を両立した **Ready outcome** を作る責任主体として動く。

この契約は worker が選ぶ実装手順を増やすためではない。AI に意味判断を任せ、GitHub Actions / Integration には機械的に検証できる不変条件だけを残すための境界である。

## Worker states

実装側の意味状態は 3 つだけとする。

- `WORKING`: Astra が実装、必要 context の選択、意味衝突の解消、検証内容の選択を所有している。
- `READY`: current `develop` と整合した exact head、必要十分な validation evidence、push 済み source が揃い、実装責任を Integration へ handoff した。
- `BLOCKED`: repository contract とユーザー要求から安全に一意解を作れず、ユーザー判断・権限・外部入力が本当に必要な状態。CI pending、通常の base drift、同一 file 競合、技術的難しさだけでは `BLOCKED` にしない。

Draft / Ready は GitHub の transport state として使えるが、Draft を通常タスクの必須工程にはしない。長時間作業、dispatch、途中共有など GitHub 上で `WORKING` を可視化する価値がある場合だけ Draft を使う。短寿命タスクは branch 上で完成させ、最終 outcome が揃った時点で Ready PR を直接作ってよい。

## GOAL

ユーザー要求を current `develop` 上で成立させ、独立して統合可能な Ready outcome を作る。

## MUST

Ready にする exact head は次をすべて満たす。

- current `develop` の契約と意味的に整合している。
- current `develop` を work branch の祖先として含む。base が進んだ場合は意味を保って reconcile する。
- Astra が変更責任とリスクから選んだ必要十分な validation evidence が、最終 reconciled head に対して成功している。
- push 済み head と validated head が一致している。
- PR に exact head、reconciled develop SHA、実行した evidence、未確認事項を短く残す。
- 未解決の重大な product / schema / save / protocol / security 等の選択がない。

途中でテストするか、何回テストするか、どの helper を使うかは worker が判断する。**必須なのは最終 reconciled head の必要十分な evidence であり、reconcile 前後の二重検証そのものではない。** 早期検証がデバッグを速めるなら自由に行う。

## MUST NOT

- test、review、exact-head、Production gate を弱めて通す。
- true semantic conflict を無条件の ours / theirs で潰す。
- main / Production を明示許可なしで変更する。
- route 名や固定分類を守るために変更を不自然に分割する。
- CI、browser、DEV publication の完了を worker が待機・pollingする。

## Validation ownership

Astra は変更の意味を読んで validation scope を選ぶ。

例:

- CSS / copy の局所変更なら syntax と影響 UI の focused evidence。
- gameplay/domain logic なら関連 unit / behavior test と必要な build。
- shared package なら実 consumer まで含める。
- control-plane / schema / auth / infrastructure なら専用 contract と必要な追加 check を選ぶ。

既存の affected / context / pre-ready helper は判断を補助する道具であり、worker の思考を置き換える固定儀式ではない。

## Deterministic boundary

`READY` 以降は機械側が担当する。

- current exact head / Ready / hold / dependency / review state の再取得
- exact-head static / syntax / code-health / 必要 build
- current develop に対する freshness と race の処理
- serialized expected-head / CAS merge
- DEV publication と source verification

Ready 後に develop が進んだ短い race は Integration が吸収する。semantic repair が必要な場合だけ同じ source PR を再び `WORKING` に戻し、Astra が current state から解き直す。

## PULSE presentation

PULSE の利用者向け開発状態も `WORKING / READY / BLOCKED` を正面に出す。Fast Lane、Repair、CI stage 等は機械内部の詳細として technical disclosure に残す。

PULSE は GitHub で観測できる状態だけを表示する。Draft を使わない短寿命 worker の作業途中を推測したり、第二の task database / heartbeat を作ったりしない。
