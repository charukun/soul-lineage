作業内容がひと目で分かる短いタイトル
変更・修正・追加する内容の簡潔な詳細

<!-- 上の2行を具体的な内容へ置換。先頭に空行・見出しを置かない。 -->

## 変更理由と挙動

## 影響範囲

- Apps / packages:
- 共有契約・他WORKとの関係:

Depends-On: none

## Final head evidence

- final reconciled exact headで実行したevidenceと結果:
- reconciled develop SHA:
- 未確認事項 / BLOCKED判断:

## DEVでの確認

- AIが採用した仮定・可逆的な選択:
- 公開後に見てほしい画面・操作:
- 目視で調整したい点（任意の確認。公開前の承認待ちにはしない）:

## 確認エビデンス

- キャプチャー／動画（取得した場合は最終応答にも画像を直接表示、または動画を添付）:
- 撮影対象SHA / 確認環境:
- 確認した画面・操作 / 結果 / 未確認範囲:
- 未取得の場合の理由（CI待ちはしない）:

## Outcome handoff

- branch / exact head SHA:
- Outcome: WORKING / READY / BLOCKED
- Ready for review: 未完了（READY時に更新）
- Worker結果: 未完了（READY時 `READY_FOR_INTEGRATION`）
- CI/browser/merge/DEV監視担当: Integration

[Astra Outcome Contract](../docs/ASTRA_OUTCOME_CONTRACT.md) と [実行ポリシー](../docs/RINNE_PROJECT_EXECUTION_POLICY.md) に従う。Draftは長時間作業・dispatch・途中共有のoptional visibilityであり、通常タスクの必須工程ではない。READY化後はCIのRunning/Queued/Pendingを待たず結果を返して終了する。repository contractとuser intentだけでは安全に解けないproduct/permission/external-input choiceだけをBLOCKEDとし、可逆的な細部はAIが判断する。main/Productionと品質gateは明示契約どおり維持する。
