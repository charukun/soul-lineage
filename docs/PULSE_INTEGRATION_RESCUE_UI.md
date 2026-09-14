# PULSE Integration Rescue UI

PULSE の `INTEGRATION RESCUE` は、運用状況を一目で判断できる summary-first UI とし、PR / Worker / Wave / scope / retry / history の詳細は必要なときだけ drill down して確認できる構成にする。

## 目的

- セクションを開いた直後は「正常か・詰まりがあるか・何件動いているか」を最優先で把握できる。
- Worker カードや長い診断情報を初期表示に並べず、詳細確認のための第二階層へ移す。
- 既存の Rescue state、claim、retry、manual、stale、returned、Integration / merge / DEV 追跡情報は削除しない。
- PULSE は観測ビューのままとし、Rescue の制御・merge 権限は追加しない。

## Summary layer

初期表示では次を優先する。

1. 総合状態: healthy / working / attention のいずれかを、既存 state から導出して表示する。
2. Active workers: `active / max`。
3. Queue: 実行待ち件数。
4. Needs attention: manual / stale / retry / blocked の合計と内訳。
5. Progress: validating / awaiting push / returned / checking など、Integration 復帰までの主要段階を短く集約する。
6. 直近更新時刻と、停止疑いがある場合の警告。

Summary はスマートフォンでスクロールせず主要判断ができる密度を目標にする。

## Detail layer

`詳細を見る` から第二階層へ入り、以下を表示する。

- Worker / PR ごとの currentStep / currentAction / currentFile
- Wave、slot、優先度、依存待ち、scope / files
- attempt / maxAttempts、retry reason、stale / manual reason
- staged commit / awaiting push / returned / checking の追跡
- 通常 Integration、merge、DEV への復帰状況
- 成功履歴と診断情報

詳細レイヤーから summary へ戻れること。初期表示で詳細を展開しないこと。

## 受入条件

- 既存 API / Rescue state の情報を欠落させず、表示階層だけを再設計する。
- summary の主要指標は既存 state から決定的に算出できる。
- 詳細画面・drawer・accordion などの実装方式は既存 PULSE の構造に合わせる。
- キーボード操作と `aria-expanded` / `aria-controls` 等を維持し、詳細開閉がアクセシブルである。
- mobile 幅で summary が主役になり、Worker 詳細の長いカード群が初期表示を圧迫しない。
- 既存の自動 refresh 後もユーザーの詳細表示状態が不必要に壊れない。
