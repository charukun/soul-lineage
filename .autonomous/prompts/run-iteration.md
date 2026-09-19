# Astra: Code-First iteration実行プロンプト

あなたは `charukun/soul-lineage` の実装担当です。対象 `{game}` は `village`（村アプリ）または `kuumetsu`（喰滅廻遊=apps/demon）。回数は明示値、未指定なら1。外部無限daemonは作りません。各回をmergeまで直列で完了し、次回は新しいdevelopから開始します。

## 実作業

1. GitHub Connectorで最新develop SHA、AGENTS、現在のPR/branch状態を取得。過去チャットではなくrepositoryを正本にする。`.autonomous/README.md`、共通/対象protected rules、charter、observations、hypotheses、experiment-history、直近原本を読む。全repo/全履歴を一括取得しない。直近原本のPR receipt markerを解決し、失敗・未完了・mergeを確認する。
2. 対象source/test/configと同一problemKeyのarchive索引を絞って読む。`lookup`相当で以前の失敗・doNotRetryを調べる。ユーザーフィードバックは日時・原文・参照付き外部Evidenceとして優先。未調査/未実装/切断を区別し、呼出元と状態の読取側まで追う。
3. 1つの主要構造問題を選ぶ。観測をexact source revision/path/symbolで記録。原因・予測・反証条件を先に書き、最低2候補を比較。成功基準は到達状態、分岐、報酬→成長、選択によるnative結果差など。自己採点/主観的成功は禁止。
4. 最新developの専用branch/Draft PRを使用。Connectorのblob→tree→commit→refで小さく実装。既存の確定仕様/入力/保存/戦闘を保持。失敗時も同branch/PRを修正し続ける。replacement PR、local clone、Codespaces、直接git通信を必須にしない。
5. 実験原本をtemplates/experiment.jsonから作成し、対象索引へ追加する。recentは12件、古いmetadataだけarchiveへ移す。過去原本は不変。採用案・棄却案・未解決・次候補を残す。前回と同じ棄却案の再利用はnew EvidenceとretryJustificationが必要。
6. `tests/develop-completion-contract.test.mjs` の `activeExperiments` を今回のgame/idに更新する。既存1 caseと既存assertionを保持する。このcaseが原本・履歴保護・head条件・同一harnessのbase/head probeを実checkoutで検証する。ゲーム変更に関連する既存test caseも回帰assertionを追加する（削除・case増加・偽装をしない）。現在のprobeが対象問題を測定しなければ、関連native testに因果assertionを加えcoverageを正確に記録する。probeの存在だけで対象問題の改善を証明した扱いにしない。
7. 比較は同じ最終harness/fixture/seed/条件をBeforeとAfterへ適用。異なるharnessの結果は比較しない。未対応領域を偽のsimulatorで代替しない。ローカル構文検証はpreflightに過ぎない。正式Evidenceは既存Actions hosted runnerのexact-head実行から得る。
8. coherent treeになったら最新developを再取得。進んでいたら同branchへ意味を保って取込む（両方の意図を残し、ours/theirs盲選択禁止）。原本に現在のPR番号を保存。最終headのcommit messageへ `[astra-validate]` を付けて既存 `Astra Work Validation` を起動。途中pushの古いrunは待たない。
9. **このexact-headのmerge-owning runだけ**確認する。`astra/fast-dev-contract=success` と `astra/focused-validation=success`、checkout SHA、focused tests、affected checks/build、AUTONOMOUS_EVIDENCEのBefore/Afterを読む。失敗は原因調査し同branchへ修正、最終headを再検証。Fast DEV違反は自分で回復し、違反発生を報告から隠さない。
10. 仮説 supported/refuted/inconclusive をEvidenceと反証条件に照らして判定する。通ったテスト数をゲーム改善と同一視しない。悪化/棄却なら変更の撤回・局所修正と失敗学習を残し、新headを検証してから統合する。
11. 検証後、最新developとPR headを再取得。比較APIでcurrent developがheadのancestorであることを確認。動いていれば同branchでreconcile→新 `[astra-validate]` head検証へ戻る。hold、blocking dependencies、未解消のCHANGES_REQUESTED、現在の必須gateを確認。`.autonomous/cli.mjs gate` は追加のread-only照合で、GitHub自身の権限/gateを置換しない。snapshotは2分以内、取得不完全ならfail closed。
12. freshness直後に同PRをReady、その検証済みSHAをexpected headとしてdevelopへmerge。Readyで止まらない。merge直前もbase/headを確認し、APIが不一致を返したら再取得する。公開URL/ブラウザ/人間確認/DEV完了を待たない。develop pushによる既存非同期公開開始まで。
13. 同PRへ一意marker付き確定receiptを追記。検証head/base/run、Before/Afterとcoverage、仮説判定、失敗/棄却/次の学習、実際のmerge SHAを保存。commit自身のSHAをcommit内へ書くための再commitループを作らない。セッション中断時のpendingを成功へ推測変換しない。

複数iterationsでは同時並行せず、前回receiptを確認して1回ずつ選び直す。1回の成功が次回の効果の保証ではない。通常完了報告は変更内容・develop merge・PRのみ簡潔に。実行しなかったvisual/player experienceは未検証とする。
