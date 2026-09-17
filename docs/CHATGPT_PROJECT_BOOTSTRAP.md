# ChatGPT Project bootstrap

ChatGPT Project側の長い重複指示を置き換えるための短いbootstrap。Repository内の詳細ルールをProject instructionsへ複製しない。

Project instructionsへ設定する場合は、次の本文だけを使う。

```text
Repository: charukun/soul-lineage
原則1実装タスク=1新規・短寿命セッション。正本は最新developと現在のGitHub状態です。
開始時は最新develop SHA → AGENTS.md → checkoutがあれば npm run context:plan -- --task "<要約>" → 必要文書だけ。取得制限の正本はdocs/CONTEXT_EFFICIENCY.md。checkoutがなければAGENTSの案内から必要箇所だけ取得します。
過去チャット全文・全docs・巨大diff・全CIログを初期投入せず、metadata→ファイル名/失敗job→必要patch/範囲で絞ります。
実装はAstra Outcome Contractに従います。WORKINGではAstraが実装・semantic reconciliation・validation choiceを所有し、READYはcurrent developを祖先に含むfinal exact head・必要十分なevidence・push済みsourceが揃った状態です。Draftは長時間作業・dispatch・途中共有だけのoptional visibilityで、通常タスクの必須工程ではありません。変更量によるworker-facing route分類を作りません。
READY→READY_FOR_INTEGRATIONで実装セッションを終了し、CIを待機・pollingしません。Integrationがexact-head gate、serialized expected-head/CAS merge、Ready後のrace、DEV公開を所有します。1経路の失敗だけで中断しません。
同一Repository・既存Codespacesへの依頼成果（コード・モデル・Blender元データ・Git bundle）の転送、作業branch push、依頼されたLab公開は継続承認済み。docs/DELIVERY_AUTHORIZATION.mdを参照し、同じ許可を再質問しない。
引き継ぎはrepository/branch/exact head SHA/PR/READYまたはBLOCKED/reconciled develop/evidence/必要statusで行います。
main/Productionは明示許可時のみ変更。品質gateを弱めません。
```

このbootstrapはRepository側ルールへのポインタであり、GitHub経路・通知・Integration・Repair・browser・motion等の詳細を再掲しない。詳細はタスクで必要になった時だけ `context:plan` の候補から取得する。

ChatGPT製品が自動付与するsystem / tool definitions / memoryやProject内会話参照そのものはRepositoryから変更できない。Project設定の変更が必要な場合はChatGPT側のProject UIで行う。

Projectの整理はこの本文へのinstructions置換を先に行い、Project-only memoryは現在UIに変更項目がある場合だけ設定する。認証前・変更項目未確認の状態で「設定済み」「作成時固定」と断定しない。`輪廻転焦 ARCHIVE`への移動は、GitHub成果が確認できる完了済みチャットに限定し、進行中・Integration/Repair参照中・現行仕様の意思決定・判断不明のチャットを残す。削除しない。
