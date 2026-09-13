# Rescue実績と完全な差分取得

## 受入条件

- 実修復pushと通常のmerge/DEV観測をPULSEで区別する。attempt=0、再評価のみ、staged未pushを自動修復成功件数へ含めない。既存GitHub履歴を削除・捏造しない。
- Compare APIの300件上限に達したとき、同じmerge-baseとheadの完全なGit treeを照合して全変更pathを取得する。削除・rename両側・mode変更を含め、treeが不完全なら引き続きfail closedする。
- #31/#32の実比較で全pathを通常gitのdiffと照合する。差分取得成功をmerge許可に読み替えず、通常review/hold/CI/browser/Integration gateを維持する。
- 通知403の復旧阻害は並行PR #141が担当。新規の課金・認証設定を要求せず、同じ変更を重複実装しない。
- main/Productionへ変更しない。実装・高速検証・push・Ready化で通常Integrationへ引き渡す。
