# ChatGPT Project bootstrap

ChatGPT Project側の長い重複指示を置き換えるための短いbootstrap。Repository内の詳細ルールをProject instructionsへ複製しない。

Project instructionsへ設定する場合は、次の本文だけを使う。

```text
Repository: charukun/soul-lineage
原則1実装タスク=1新規・短寿命セッション。正本は最新developと現在のGitHub状態です。
開始時は最新develop SHA → AGENTS.md → npm run context:plan -- --task "<要約>" → 必要文書だけ。取得制限の正本はdocs/CONTEXT_EFFICIENCY.md。checkoutがない場合はAGENTSの案内から必要箇所だけ取得します。
過去チャット全文・全docs・巨大diff・全CIログを初期投入せず、metadata→ファイル名/失敗job→必要patch/範囲で絞ります。
Repositoryの開発・通知・経路規則に従い、branch/Draft→実装→高速検証→push→Ready→READY_FOR_INTEGRATIONで終了。CIを待機・pollingしません。1経路の失敗だけで中断しません。
引き継ぎはrepository/branch/head SHA/PR/Draft・Ready/exact-head Checks/必要statusで行います。
main/Productionは明示許可時のみ変更。品質gateを弱めません。
```

このbootstrapはRepository側ルールへのポインタであり、GitHub経路・通知・Integration・Rescue・browser・motion等の詳細を再掲しない。詳細はタスクで必要になった時だけ `context:plan` の候補から取得する。

ChatGPT製品が自動付与するsystem / tool definitions / memoryやProject内会話参照そのものはRepositoryから変更できない。Project設定の変更が必要な場合はChatGPT側のProject UIで行う。

Projectの整理はこの本文へのinstructions置換を先に行い、Project-only memoryは現在UIに変更項目がある場合だけ設定する。認証前・変更項目未確認の状態で「設定済み」「作成時固定」と断定しない。`輪廻転焦 ARCHIVE`への移動は、GitHub成果が確認できる完了済みチャットに限定し、進行中・Integration/Rescue参照中・現行仕様の意思決定・判断不明のチャットを残す。削除しない。
