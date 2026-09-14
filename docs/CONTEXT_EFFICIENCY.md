# Lean Context / Token Budget Policy

輪廻転焦のChat / WORK / Codexセッションは、RepositoryとGitHubを正本にしつつ、タスク遂行に不要な履歴・ログ・文書を最初から大量投入しない。目的は、品質や検証条件を落とさずに、回避可能な入力コンテキストとツール出力を減らすこと。

このポリシーはChatGPT製品側が自動注入するsystem / Project / memoryコンテキストの量や、プラン固有の利用上限をRepositoryから変更するものではない。Repository側で制御できる「何を取得するか」「どの粒度で読むか」「何を正本にするか」を軽量化する。

## 受入条件

- セッション開始時に過去会話、closed PR、Actions履歴、全docs、全diffを一括取得しない。
- 最新developとGitHubの現在状態を正本とし、古い会話・古いSHA・旧handoffを再注入して状態復元しない。
- `AGENTS.md` と、タスク種別に必要な最小文書だけを読む。追加文書は必要になった時点で取得する。
- GitHub APIは、一覧→対象特定→必要部分の順に狭める。巨大PRはchanged filenames→対象file patch、Actionsは対象run→failed job→必要logの順で読む。
- 同一内容を複数経路から重複取得しない。既に得たhead SHA、PR状態、文書内容は、その状態が変わる理由があるまで再取得しない。
- 実装中のCI完了待ち・反復ポーリングを行わない。Ready後は既存Integrationへhandoffする。
- タスクに必要な参照候補を小さく列挙する `npm run context:plan` を提供し、全文を束ねた巨大なcontext dumpは生成しない。
- context削減を理由に、既存のテスト、review、Integration、browser gate、Production gateを弱めない。

## 取得順序

1. 最新 `develop` のSHAと `AGENTS.md` を確認する。
2. `npm run context:plan -- --task "<依頼の要約>"` または対象pathを指定し、参照候補を得る。
3. 候補のうち今回の判断に必要な文書・コードだけ取得する。
4. GitHub状態が必要なら、まずPR/commit/checkのmetadataを取得し、詳細diff/logは問題箇所だけ追加取得する。
5. 実装後はbranch / commit / PR / Ready状態をGitHubへ残し、次セッションはその正本から再開する。

## 原則として初期投入しないもの

- Project内の過去会話全文や大量の会話要約
- merged / closed PRの本文・コメント・diff一式
- 過去のworkflow run / job log一式
- Repository全体のfile treeや全docs全文
- binary / generated assetのBase64や巨大なbuild artifact
- 現在のGitHub状態で置き換えられる古いcommit SHA、古いhandoff、過去セッションの進捗説明

必要な歴史的経緯を調べるタスクでは例外として取得してよい。ただし検索で候補を絞り、関連箇所だけ読む。

## GitHub取得の粒度

- PR調査: PR metadata → changed filenames →必要file patch →必要review/comment。
- CI調査: exact head status →対象run →failed/cancelled job →そのjobのstep/log。成功jobのlogは通常読まない。
- コード調査: file/path検索 →該当file →必要なら周辺file。最初からRepository全体を列挙しない。
- 文書調査: `AGENTS.md` → task-specific doc。`DEVELOPMENT.md` / `INTEGRATION.md` / `RINNE_PROJECT_EXECUTION_POLICY.md` を毎回無条件に全文取得しない。役割やdelivery境界の確認が必要なタスクでのみ読む。

## Hard budget phase

`context:plan` は参照候補の列挙だけでなく、初期全文取得に使えるbyte budgetを持つ。既定値は48 KiBとし、`--max-bytes`で明示変更できる。これはtoken数の推測ではなくRepository文書のUTF-8 byte数に対する上限である。

- budget内の文書だけを `read` として返し、超過候補は `deferred` として全文取得を避ける。
- `deferred` は不要という意味ではない。検索・見出し・必要line rangeで絞って読む対象である。
- `AGENTS.md` は最優先。task-specific文書はrouting順を維持し、予算超過時に巨大context dumpへ戻らない。
- AGENTS自体が上限を超える場合もdeferredとし、その必要範囲を最初に読む。容量不明の文書や8件の全文候補枠を超えた文書もdeferredに残し、0 byte扱いや候補の黙示破棄をしない。
- changed pathsが多いPRではwhole diffを既定にしない。12 filesまたは2,000 changed linesを超える場合はmetadata → changed filenames → file patchへ切り替える。
- binary含有またはdiff統計が不明の場合もfile patch経路とする。binary本体は読まずmetadataを使う。
- Actions調査はfailed/cancelled jobだけを対象にし、logは原因周辺を64 KiB以内へ絞る。追加範囲が必要なら同じlogを重複取得せず次の範囲を読む。
- 同じexact headに対して既取得のPR metadata / checks / documentを無理由に再取得しない。headが変わった、状態遷移が起きた、または追加証拠が必要な場合だけ更新する。

Hard budgetは品質gateではなく取得戦略である。必要な仕様を読まずに判断するための免罪符にしない。予算を超える場合は全文投入ではなく、検索・line range・file patchへ粒度を落として必要情報を回収する。

最終受入条件: AGENTS.mdも全文byte上限の例外にせず、容量不明・候補数超過はdeferredに残す。diff規模が取得できない場合はfile patchへ倒す。範囲出力はUTF-8 byte数で制限し、同一セッションで同じ内容を別経路から再投入しない。

## 範囲出力・重複抑制

`context:excerpt` はローカル文書/patch/logをコンテキストへ出す直前に使う。セッションごとにscratchのledgerを1個用意し、同じセッションの全取得経路で共有する。ledgerには内容のSHA-256だけを保存し、次の新規セッションには引き継がない。既に読んだ同じ内容の再出力は0 byteとなり、変更内容は出力する。並列writerで同じledgerを更新しない。

```sh
npm run context:excerpt -- --file docs/DEVELOPMENT.md --start 1 --end 35 --ledger /tmp/rinne-context-session.json
npm run context:excerpt -- --file /tmp/failed-job.log --kind log --conclusion failure --start 120 --end 160 --ledger /tmp/rinne-context-session.json
```

doc/patchは最大48 KiB、logは最大64 KiB。`--max-bytes`で縮小できる。巨大docは全文出力を拒否し、log/patchは明示line rangeを必須とする。logは現在のjob metadataで確認した`failure`/`cancelled`だけを対象にし、成功jobを失敗として渡さない。巨大な単一行もstreamで制限する。`truncated=true`は未読部分があるという意味で、原因を確認済みとはしない。別範囲やローカル検索で追加調査する。

このコマンドは取得済みローカルファイルの出力制限であり、GitHub APIの転送量・ChatGPT側の自動注入・外部ツール呼び出しを強制制限しない。APIにrange機能があれば先に範囲を限定する。全文しか返せないlog APIは応答をモデルへ直接展開せず、実行環境に保存して絞る。context:planの48 KiBは初期全文候補の合計、excerptの上限は1回の本文出力であり、両者をセッション全体のtoken上限と混同しない。

metadataは`repository + PR + head SHA`、文書は`repository + blob SHA/path`、logは`run id + attempt + job id + range`を取得メモに残す。同一headでもChecks完了・review・holdなど状態が変わることはある。明確な状態遷移・修正依頼・追加証拠を契機に必要項目だけ更新し、headだけを理由に古いChecksを成功判定へ使わない。Ready後は再取得せずIntegrationへ渡す。

ツール応答は実行環境内で必要fieldだけに絞ってから表示する。metadataの巨大JSON全体、ツール一覧の全schema、同じ内容のtext/structuredContent二重表示を避ける。既取得情報を文書・API・ブラウザの別経路で再収集しない。

## セッション引き継ぎ

引き継ぎに必要なのは会話履歴ではなくGitHub上の現在状態。最低限、repository、branch、head SHA、PR、Draft/Ready、base、最新checks、必要ならhandoff/statusを使う。実装内容はPR diffとcommitを正本とする。

原則は「1実装タスク = 1短寿命の新規セッション」。最新develop → AGENTS.md → context:plan → 必要文書 → 実装 → fast validation → push → Ready for review → READY_FOR_INTEGRATION → 終了とし、会話全文を引き継ぎデータにしない。

人間向け説明が必要な場合も、過去会話を再掲する代わりに「現在何が正しいか」を短く報告する。履歴そのものが目的の依頼だけは時系列を取得する。

## 製品側コンテキストとの境界

ChatGPT Projectが自動で付与するProject instructions、memory、system/tool definitionsなどはRepositoryから削減・変更できない。したがって `context:plan` が示す削減量はRepository / GitHub取得側のみを対象とする。製品側の残量表示と1:1対応する数値を推測・保証しない。
