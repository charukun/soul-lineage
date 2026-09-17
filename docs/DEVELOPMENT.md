# Development WORK

通常の実装セッションが担当する範囲だけを定義する。現行資料の入口と優先順位は [`README.md`](README.md)、実装終了・通知・非同期待機の詳細は [`RINNE_PROJECT_EXECUTION_POLICY.md`](RINNE_PROJECT_EXECUTION_POLICY.md) を正本とする。

## 完了境界

```text
latest develop
  -> work branch / Draft PR
  -> implementation
  -> affected focused validation
  -> push
  -> Ready for review
  -> READY_FOR_INTEGRATION
  -> session ends
```

Ready 後の CI 監視、develop merge、DEV 公開、明示browser verification、repair は Integration または専用経路の責任。実装 WORK は Running / Queued / Pending の check を完了まで watch・sleep・polling しない。

## 標準手順

1. 最新 `develop` SHA と `AGENTS.md` を確認する。checkout があれば `npm run context:plan -- --task "<要約>"` を実行し、必要資料だけ読む。
2. 最新 `develop` から専用 branch を作る。コード変更を伴う通常タスクは、コード編集前に branch を push して develop 向け Draft PR を作る。
3. GitHub は差分のない branch から PR を作れないため、必要なら既存仕様・運用文書へ今回の受入条件を最小限追記して最初の意味ある差分にする。ダミーファイル、空 commit、恒久的に無意味な履歴は作らない。文章・資料だけを更新するタスクは、その意味ある資料差分自体を最初の commit にしてよい。
4. 実装する。確定要件と現在の `develop` 契約を守る範囲の可逆的な細部は AI が選び、重要な仮定を PR に短く残す。
5. **実装セッション内では**変更した機能に必要な局所テスト・check・buildを行う。通常は `npm ci`、対象app/packageの focused test/check/build、必要なら `node scripts/validate.mjs fast origin/develop HEAD` を使う。基盤変更は関連する基盤contractを確認する。毎回の全体 E2E・全ゲーム browser 総点検は不要。
6. push 前に `npm run push:route -- origin/develop HEAD` を使える環境では実行する。通常 git → 接続済み GitHub API → 同じ branch の既存 Codespaces + 通常 git の順に復旧する。1経路の失敗だけで終了しない。
7. 実装と必要な局所検証が完了したら PR 本文を実施結果へ更新し、Ready for review にする。
8. branch / exact head SHA / PR / Ready / 実行済み検証を報告し、`READY_FOR_INTEGRATION` で終了する。handoff recorder、通知、CI、DEV 公開の完了待ちはしない。

## PR 契約

PR 本文は空行・見出し・HTML コメントを先頭に置かず、必ず連続した2行で始める。

```text
短い作業タイトル
何を変更・修正・追加するか分かる簡潔な詳細
```

3行目以降に必要な情報を置く。

- 変更理由 / 挙動
- 影響 app / package
- 実行した検証と未確認事項
- `Depends-On: #N` または `Depends-On: none`
- AI が採用した重要な仮定
- DEV で確認してほしい画面・操作（該当時）

GitHub 標準状態をそのまま使う。

| 状態 | 意味 |
| --- | --- |
| Draft | 作業中 / 未完了 |
| Ready for review | Integration 待ち |
| Merged | develop 統合完了 |
| Closed (unmerged) | 中止 / 終了 |

独自 Task-ID、第二のタスク DB、別の永続 queue を追加しない。

## Ready にしてよい条件

- 依頼された実装が完了している。
- 変更した機能に必要な局所検証が成功している。
- current head が push 済み。
- 未解決の重大な契約選択がない。
- 既存の hold / Changes requested / unresolved thread / dependency を勝手に解除していない。

技術的に難しい、同じ file を触っている、見た目を後で調整できる、DEV で実物を見たい、という理由だけでは Draft / human-required に止めない。現在仕様へ安全に適応できる古い PR や機械的競合は修復対象。

未実装、局所検証失敗、権限不足、互換性を壊す save/schema/protocol 等の未承認選択、確定仕様から解けない重大な契約矛盾は Ready にしない。実行可能な修復を行い、それでも人間判断が必要な対象だけ理由を具体化する。

## develop CI と品質境界

**develop向けGitHub CIは自動テストを実行しない。** Ready後の `Validate and build` は、exact-headの差分/構文・静的check・code-health・必要なbuild可否とIntegration用artifactを確認するだけで、`node --test`、browser smoke、gameplay/WebGLテストは実行しない。Fast Repairのexact-head再検証も同じtest-free DEV contractを使う。

これはテストの削除ではない。実装セッションはReady前に変更機能の局所テストを行い、既存テスト資産は保持する。全体回帰、browser/WebGL、P2P等の重い検証は、ユーザー明示playtest、`full_verification=true`、専門evidence workflow、main / Productionの品質gateで実行する。main / Production の blocking gate は不変。

テストは実装の書き方ではなく、ユーザー・ドメイン・公開インターフェースから観測できる契約を優先する。特に UI / browser テストでは、次を原則とする。

- 表示文言そのものが仕様である場合を除き、完全一致コピーより状態・役割・可視性・操作結果を検証する。
- DOM id / class / matcher 名 / helper 呼び出し文字列など、同じ挙動を別実装でも成立させられる内部表現を二重に固定しない。
- 別テストファイルを文字列として読み込み、「そのテストが `toBeHidden()` を使う」「この selector を直接書く」などのテスト実装詳細を検査しない。必要なら共有 helper / 公開 contract / 実ブラウザ挙動を直接検証する。
- 起動、主要入力、保存、復元、致命的 console/page error、重要なゲーム状態遷移など、ユーザー影響が大きい失敗は明示検証またはProduction gateでは引き続き厳格に fail させる。
- timeout 延長、force click、assertion 削除、常時 retry で不安定さを隠さない。DEV CIでテストを自動実行しないことと、テスト自体を弱めることは別扱いにする。

単一 app の変更を root ゲーム構成へ戻さず、`apps/<id>` と `packages/<id>` の境界を維持する。詳細は [`MONOREPO.md`](MONOREPO.md) と [`PLATFORMS.md`](PLATFORMS.md)。

## GitHub / Codespaces 経路

Codespaces は別開発フローではなく搬送経路の代替。branch、PR、局所検証、Ready handoff は変えない。容量・Base64・payload 上限のときは同じ branch を Codespaces で開き通常 `git push` へ切り替える。大きなバイナリを API 経由で分割再送しない。詳細は [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md)。

依頼成果を同 Repository / 既存 Codespaces へ転送・push する許可は [`DELIVERY_AUTHORIZATION.md`](DELIVERY_AUTHORIZATION.md) に記録済み。同じ範囲の許可を再質問しない。

## 復旧

セッションが停止しても最初から作り直さない。GitHub の現在状態から、同じ PR / branch を復旧する。

必要な引き継ぎ情報は repository、branch、head SHA、PR、Draft/Ready、base、必要な exact-head Checks/status。過去チャット全文や古い handoff を正本にしない。

Ready なら修正依頼なしに CI 待機セッションを再開しない。失敗が返された場合は同じ PR / branch で必要な修正 → 局所検証 → push → Ready まで進め、再び Integration へ返す。

## 関連資料

- Integration: [`INTEGRATION.md`](INTEGRATION.md)
- Repair / legacy Rescue compatibility: [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md)
- Context budget: [`CONTEXT_EFFICIENCY.md`](CONTEXT_EFFICIENCY.md)
- Browser verification / repair: [`BROWSER_SELF_HEALING.md`](BROWSER_SELF_HEALING.md)
- Documentation map: [`README.md`](README.md)
