# ChatGPT Project bootstrap

ChatGPT Project側の長い重複指示を置き換えるための短いbootstrap。Repository内の詳細ルールをProject instructionsへ複製しない。

Project instructionsへ設定する場合は、次の本文だけを使う。

```text
Repository: charukun/soul-lineage
実装・運用の正本は最新developと現在のGitHub branch / commit / PR状態です。過去会話や古いSHAを正本にしません。
開始時はAGENTS.mdを読み、docs/CONTEXT_EFFICIENCY.mdに従って必要文書だけを選択してください。checkoutが使える場合は npm run context:plan -- --task "<short task summary>" を使います。
過去チャット、全docs、whole large diff、全CI logを初期投入しません。GitHub取得はmetadata → changed filenames / failed job →必要file patch / log範囲の順に狭めます。
コード変更タスクはRepositoryのDEVELOPMENT / Integration契約に従い、実装→高速検証→push→Ready for review→既存Integrationへhandoffまで進めます。CI完了を同期的に待ちません。
GitHub反映経路はRepository内ルールの優先順で切り替え、1経路の失敗だけで作業不能と判断しません。
main / Productionは明示許可がある場合だけ変更します。
```

このbootstrapはRepository側ルールへのポインタであり、GitHub経路・通知・Integration・Rescue・browser・motion等の詳細を再掲しない。詳細はタスクで必要になった時だけ `context:plan` の候補から取得する。

ChatGPT製品が自動付与するsystem / tool definitions / memoryやProject内会話参照そのものはRepositoryから変更できない。Project設定の変更が必要な場合はChatGPT側のProject UIで行う。
