# Rescue実績と完全な差分取得

## 受入条件

- 実修復pushと通常のmerge/DEV観測をPULSEで区別する。attempt=0、再評価のみ、staged未pushを自動修復成功件数へ含めない。既存GitHub履歴を削除・捏造しない。
- Compare APIの300件上限に達したとき、同じmerge-baseとheadの完全なGit treeを照合して全変更pathを取得する。削除・rename両側・mode変更を含め、treeが不完全なら引き続きfail closedする。
- #31/#32の実比較で全pathを通常gitのdiffと照合する。差分取得成功をmerge許可に読み替えず、通常review/hold/CI/browser/Integration gateを維持する。
- 通知403の復旧阻害は並行PR #141が担当。新規の課金・認証設定を要求せず、同じ変更を重複実装しない。
- main/Productionへ変更しない。実装・高速検証・push・Ready化で通常Integrationへ引き渡す。

## 実データによる確認（2026-09-13 UTC）

- PR #31の変更は12ファイル、#32は1ファイル。共通merge-baseは `43ce1591fce0d3cfe2f72abe74f086c8fe295cff`。問題はPR自身のサイズではなく、その分岐点からdevelopまでの比較だった。
- develop `9e65227c354af92291f4820294384bfe11213cdb` とのCompare API応答は300件。merge-base tree `bd3e4809bbdb69e092bc68e9907846c74899707d`（494 entries）とhead tree `2f9ee6451fb1a05b89fb3a597276d7a77838aaaa`（857 entries）は両方 `truncated=false`。実API応答を新しいcomparison処理へ通した結果は **395 paths** で、`git diff --name-only --no-renames` の全pathと一致した。Compareを含め4 GETで完了する。
- Rescue state revision 70（`2026-09-13T04:41:40.950Z`）を変更せず旧・新collectorへ通した。旧表示 `Rescued 0 / Merged 2` は、新表示 `Rescued 0 / Merged 0` と別枠の通常観測 `merge 2 / DEV 2` になった。対象は #113・#131、両方attempt=0、修復pushなし。履歴イベント93件は保持した。
- 通知403の修正は #141、merge commit `88d7679` に含まれる。通知より先にIntegration復帰を実行し、送信失敗を未送信のまま有限backoffする。今回のbranchへ取り込み、同じ修正は重複実装しない。

## 証跡と安全境界

- `Rescued` とその後の `Merged` は、attempt>0、同じclaim/Worker、claim後のpush・復帰時刻、修復commit SHA、そのSHAのvalidation成功を確認できる保持記録だけを数える。再評価のみ・staged未push・別attemptのイベントは含まない。過去claimの証跡が残っていない場合は保守的に通常観測へ分類するため、これは生涯累計ではない。
- Wave完了はWorker処理終了を示す。修復push確認数とIntegration復帰数を別表示し、AWAITING_PUSHを修復済みに数えない。
- tree比較はmerge-base対headで行い、削除・rename両path・binary・mode・symlink・submodule変更を含める。SHA不一致、不正entry、重複path、truncated treeはfail closed。取得成功だけでreview/hold/CI/browser gateを通過した扱いにはしない。
- [GitHub Compare API](https://docs.github.com/en/rest/commits/commits#compare-two-commits) はfile一覧が最初のページのみ・最大300件。[Git Trees API](https://docs.github.com/en/rest/git/trees#get-a-tree) のrecursive応答も上限があるため、`truncated=false` を必須とする。

## 検証と引き渡し

- 比較・PULSE回帰16件成功。完全差分、300件境界、rename/mode、truncated拒否、試行0回、再評価、未push、別claim、表示上限外のWave実績を検証した。
- `npm ci` と `node scripts/validate.mjs fast origin/develop HEAD` 成功。全579件中578件pass、GitHub runner専用UID検証1件はローカルでskip。通知403回帰はpass。demon / rinne / villageの3buildも成功した。コードは `88d7679` のdevelopと統合して検証した。
- PULSE browser gateにも通常観測・再評価・未pushのラベルと、誤ったPUSH完了表示がないことの回帰を追加。実ブラウザ実行は非同期Integrationのgateで確認する。
- この証跡は取得した実GitHubデータによる比較・collector検証であり、Rescue自動修復成功や本変更のPULSE公開完了を意味しない。Ready後のCI・統合・公開は既存Integrationへ引き渡す。
