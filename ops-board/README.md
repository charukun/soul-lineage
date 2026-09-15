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

- トップでは「要対応」「開発の流れ」「公開状況」の要約を優先し、正常時の詳細一覧は初期表示しない
- 異常や滞留は折りたたまず前面に出し、正常系のPR一覧、Rescue詳細、環境メタデータ、Actions履歴は段階的に開く
- 要約だけで現在の状態を判断できる短いラベルと件数を維持し、SHA・時刻・理由・Worker工程などの詳細は潜った先に置く
- 既存のDOM ID、取得データ、監視条件、Integration / Rescue判定は維持し、見た目の簡素化を理由に情報や品質gateを削除しない
- スマホでは縦に長い一覧を最初から並べず、タップ対象を大きくし、開閉しても現在位置や選択状態を失わない
- トップの「DEV公開」は最優先の1枚として横幅いっぱいに表示し、現在段階・経過時間・残り目安を省略せず読めるようにする
- 「今やること」「開発中」はその下で簡潔に分け、主要な状態文言は1行省略せず複数行表示を許可する

## Integration Rescue表示契約

Integration Rescueは運用者がスマホで開いた直後に「何が問題で、どれが対応中・対応待ち・完了なのか」を判断できることを最優先にする。

- 最上段では未解決件数、対応中、対応待ち、直近24時間の完了を主要指標として要約する
- 対応中カードは問題の理由、現在の作業、次の工程、Worker状態を同じ視線上で確認できるようにする
- 対応待ちカードは待機理由、依存PR、待機時間、優先度を明示する
- 完了履歴は対応中・対応待ちから視覚的に分離し、直近の完了件数と結果を確認できるようにする
- Rescueによる修復成功と、単なるIntegration / DEV状態観測を混同しない。既存の修復証跡判定を維持する
