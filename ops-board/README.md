# PULSE

スマホブラウザから、公開環境・PR・Integration・CI/CDの状態を確認するための運用ダッシュボードです。

- GitHub APIと公開deployment metadataを正本として利用
- branch mergeと実deployを分離して表示
- GitHubイベント後の即時同期 + 30分ごとの整合性同期を基本とし、短周期の全量ポーリングは行わない
- SecretsはWorker側のみで保持し、ブラウザには露出しない
- 一般公開リンクギャラリー `WAYFINDER` の専用Cloudflareデプロイ状態も追跡する
- `WAYFINDER` はPULSEの公開状況に掲載される輪廻転焦Repository内の公開先を案内する導線として扱い、別Repository・別プロジェクト（例: GUILTY'S GARDEN / YARE）を混在させない
- ゲームは公開manifestで確認できた開発・検証・本番URLのみを掲載し、Visual Review Labなどの公開ツールはPULSEでURLが確認できるものだけを掲載する

## GitHub API予算

PULSEの鮮度は「短周期で全履歴を取り直すこと」ではなく、イベント同期・差分同期・定期reconcileの組み合わせで維持する。

- PR一覧は前回の完全snapshotを保持し、通常同期では更新順の先頭ページから差分だけ取得して既存snapshotへ合成する。定期的なfull reconcile時だけ `state=all` を最後までpaginationする
- Actions、branch、compare、commit history、PR filesなどの取得は用途別TTLとETagを併用し、同一snapshot生成中の重複取得と短時間の再取得を避ける
- GitHub API残量が少ない場合はdeep enrichmentを先送りし、前回の正常snapshotを保ったまま主要状態の更新を優先する。画面都合で品質gateやIntegration判定を削らない
- GitHubイベントからのrefreshは認証済み `GITHUB_TOKEN` をその1回だけWorkerへ渡し、Worker側へ永続化しない。定期reconcileも可能ならWorker secretの認証トークンを利用する
- Integration Rescueの公開観測は、GitHub APIを経由せず取得できる公開snapshotまたは既存push経路を優先し、同じ状態を複数経路から重複取得しない
- API利用状況は1回のrefreshで使ったリクエスト数・rate remaining・同期種別をstateへ残し、上限到達そのものを通常運転にしない

## 情報設計

PULSEは情報量が増えても、トップ画面の判断密度を上げすぎない。運用者がスマホで開いた直後に必要な判断を先に出し、詳細は必要な人だけが一段潜って確認する。

- トップでは「要対応」「開発状態」「公開状況」の要約を優先し、正常時の詳細一覧は初期表示しない
- 開発状態は [`Astra Outcome Contract`](../docs/ASTRA_OUTCOME_CONTRACT.md) と同じ `WORKING / READY / BLOCKED` を正面に出す
- `WORKING`: GitHubで観測できるDraft、またはexact-head failureでimplementation ownershipへ戻った対象
- `READY`: Ready handoff後にIntegrationが所有する対象。CI、Fast Lane、mechanical repair、dependency waitはtechnical detailであり追加の利用者向けstateにしない
- `BLOCKED`: 明示holdなど、人間介入が必要だとcurrent GitHub stateから確認できる対象
- Draftはoptional transportなので、PULSEはPR未作成の短寿命workerを推測しない。第二のtask DB、独自heartbeat、作業中推測を追加しない
- 異常や滞留は折りたたまず前面に出し、正常系のPR一覧、Repair詳細、環境メタデータ、Actions履歴は段階的に開く
- 要約だけで現在の状態を判断できる短いラベルと件数を維持し、SHA・時刻・理由・Worker工程などの詳細は潜った先に置く
- 既存のDOM ID、取得データ、監視条件、Integration / Rescue判定は維持し、見た目の簡素化を理由に情報や品質gateを削除しない
- スマホでは縦に長い一覧を最初から並べず、タップ対象を大きくし、開閉しても現在位置や選択状態を失わない
- アプリ公開状況のカード一覧は、スマホでは2列を基準にし、520px以上では3列へ拡張する
- DEV更新がある間はトップの公開カードを最優先のワイドカードとして扱い、`いま`、`次`、`確認できる目安`、`現在版を今すぐ開けるか` の4点をスクロールや詳細展開なしで読めるようにする
- DEVが最新なら同じ場所で `DEVは最新です / 今すぐ確認できます` と明示し、内部工程名やSHAをトップ判断に要求しない

## 公開進捗の表示契約

公開待ち・更新中の表示は、内部状態名だけでなく「何をしていて、あとどれくらいで、いつ確認できるか」を人間向けに説明する。

- `次の更新` のような抽象ラベルだけを表示しない。更新がある場合は `いま`、`次`、`確認できる目安` を同じ表示面に出す
- DEVでは `developへ統合済み` → `公開準備` → `公開反映` → `公開確認` → `確認可能` のどこにいるかを明示する
- 最近の成功したDEV公開時間から得た既存p75目安を、アプリ別の更新表示にも再利用する。履歴不足時は既存の運用目安へfallbackし、保証時刻とは表現しない
- 公開処理が進行中なら経過時間と残り目安を表示する。開始前なら `開始待ち`、失敗なら `自動復旧待ち / 再試行中` のように次の動作を表示する
- 公開済みの版は消さず、`現在見えている版` と `次に反映する版` を区別する。更新中でも既存公開URLはそのまま開けることを明示する
- 10分以上更新が無い場合だけ通常の待ち表示から `遅延` へ昇格し、実行ログまたは修復状態へ導線を出す
- UI文言は利用者がGitHub ActionsやIntegration内部語を知らなくても理解できる日本語を主表示とし、SHAやworkflow名は詳細へ置く
- トップの「DEV公開」は最優先の1枚として横幅いっぱいに表示し、現在段階・経過時間・残り目安を省略せず読めるようにする
- 「今やること」「開発状態」はその下で簡潔に分け、主要な状態文言は1行省略せず複数行表示を許可する

## Integration / Repair表示契約

Fast Lane、Reconciliation、Repairは `READY` の内側にある機械工程として、必要時だけ詳細表示する。

- 最上段の開発カードでは内部lane名を主要stateにしない
- 詳細を開くと、未解決件数、対応中、対応待ち、直近完了、exact-head CI、dependency等を診断できる
- 対応中カードは問題の理由、現在の作業、次の工程、Worker状態を同じ視線上で確認できるようにする
- 対応待ちカードは待機理由、依存PR、待機時間、優先度を明示する
- 完了履歴は対応中・対応待ちから視覚的に分離する
- Repair成功と単なるIntegration / DEV状態観測を混同しない。既存の修復証跡判定を維持する
- 旧Planner / Virtual Train / Draft→Ready latencyの表示契約は廃止済み。現行の診断に必要なcurrent exact-head / merge / repair / DEV情報だけを表示する

## WORKINGのAI再開プロンプト

PULSEで観測できる `WORKING` Draftは、Astraが実際に現在動いているheartbeatを意味しない。Draftはoptional transportであり、短寿命workerの全量でもない。

開発タスク欄から、GitHub上に残っているDraftを一括点検して安全に再開・前進させるAI向けプロンプトを生成できるようにする。

- ボタンは通常PRのDraftを対象とし、Visual Review Labの長寿命Draftは通常タスクと混ぜない
- プロンプトには対象PR番号、タイトル、概要、head branch、exact head SHA、最終更新時刻、滞留表示の有無を含める
- 受け取ったAstraは最新developとcurrent GitHub stateを正本として各PRを再確認し、`Draft=ACTIVE` と決めつけない
- STOPPED / INTERRUPTEDは新規PRを量産せず既存branch/PRを復旧起点にする
- current developと意味的にreconcileし、**final reconciled head** に必要十分なevidenceを実行してpushし、READY / `READY_FOR_INTEGRATION`へ進める
- worker-facing route分類や、reconcile前後の固定二重検証を復旧の儀式として再導入しない
- `BLOCKED` はproduct/permission/external-input choiceなど本当に外部判断が必要な場合だけ。base drift、同file、CI pending、技術的難しさだけでBLOCKEDにしない
- 明示hold、unresolved review等の既存制御は維持し、quality gateを解除して通さない
- CI/browserのRunning・Queued・Pendingを待機・pollingしてセッションを延命しない。READY後の非同期監視はIntegrationへ引き渡す
- PULSE自身はこのボタン操作でGitHubを書き換えない。表示中snapshotを使ってコピー可能な実行promptを生成するだけにする
