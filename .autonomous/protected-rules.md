# 共通 protected rules

Source: 現在の `AGENTS.md`、`docs/DEVELOPMENT.md`、`docs/DEVELOP_MERGE.md`、ユーザーのCode-First基盤構築依頼。各iterationの開始時に最新を読み直す。

- ジャンル・世界観・確定仕様・入力方式を無断で変えない。既存仕様が不明なら「未調査」であり、欠落と決めつけない。
- Evidenceのない全面refactor、理由のない大量機能追加、UI装飾のみを構造解決扱いすることを禁止。1 root causeに絞る。
- テスト削除、assertion弱体化、review/品質gate弱体化、validationやsimulationを通す目的の仕様改変を禁止。
- Fast DEVのworkflow/step/case数/lifecycle/ネットワーク負荷を勝手に増やさない。既存の変更test選択とaffected buildを再利用する。matcherの抜け穴でテストを隠さない。
- 未検証headのReady/merge、古いheadの検証流用、main/Production変更を禁止。PR/head/baseが動けば同branchでreconcileして新しいexact-headを再検証。
- 通常iterationでbrowser/Cloud Browser/agent-browser/playtest/screenshot/動画/公開URLアクセスを開始しない。人間確認やDEV完了を待たない。既存で必須の検証は省略しない。
- コードや部分simulationから「面白い」「気持ちいい」「美しい」「見やすい」「没入感が増した」「操作感が改善した」と断定しない。自己採点を成功Evidenceにしない。
- 原本experiment・失敗・棄却案を削除/上書きしない。訂正は新ID、同一失敗の再試行は変更Evidence付き。
- apps→apps、packages→appsの依存を作らない。描画/SDK/storage bootstrapをdomainへ持ち込まない。テスト用の別ゲームロジックを作らない。
- source SHA、実行head、harness、fixture、未検証範囲を区別。成功ログやPR状態をAIが作った値で置換しない。
