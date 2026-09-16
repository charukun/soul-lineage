# 実装セッション実行ポリシー

この文書は、通常の Chat / WORK / Codex 実装セッションの終了境界、DEV確認、通知、復旧を定義する。実装手順は [`DEVELOPMENT.md`](DEVELOPMENT.md)、Integration の merge / DEV 公開は [`INTEGRATION.md`](INTEGRATION.md) を正本とする。

## 正本と終了境界

実装の正本は `charukun/soul-lineage` の最新 `develop` と、GitHub 上の branch / commit / PR / Checks / status。Chat / WORK / Codex は一時的な実行環境であり、永続 CI 監視 worker ではない。

通常実装は次で終了する。

```text
implementation
  -> affected fast validation
  -> commit / push
  -> Ready for review
  -> READY_FOR_INTEGRATION
  -> final response / session ends
```

CI / GitHub Actions / Playwright / browser check が Running / Queued / Pending でも待たない。`gh run watch`、`gh pr checks --watch`、一定間隔の Actions API 取得、sleep を使う polling loopは禁止。push 直後に1回だけ短時間確認し、起動・即時失敗・明白な設定誤りを確認するのはよい。未完了ならそのまま Integration へ handoff する。

Ready 後の CI 監視、develop 統合、DEV 公開、browser gate、Integration Repair / Deep Repair、有限 retry は Integration の責任。実装 worker が「裏で追跡中」を理由に返答を保留しない。

状態名は工程を混同しない。

| 状態 | 意味 |
| --- | --- |
| `READY_FOR_INTEGRATION` | 実装・必要な高速検証・push・Ready 完了 |
| `INTEGRATED` | develop へ統合済み |
| `DEV_DEPLOYED` | 対象 develop SHA の DEV 公開検証成功 |
| `FAILED` | 実装を完遂できず、理由と復旧情報を残した |

Ready は CI 成功、merge、DEV 公開成功を意味しない。

## DEVで実物を確認する標準開発

標準ループは **AI実装 → 高速検証 → Ready → Integrationがdevelopへ統合・DEV公開 → ユーザーが実物を確認 → 指摘をAIが修正**。

明示要件・禁止事項・最新 `develop` の確定仕様を守る範囲で、見た目、操作感、文言、実装方法などの可逆的な細部は AI が選んで実装し、重要な仮定を PR に短く記録する。任意の目視確認を公開前の追加承認工程にしない。

古い PR が現在仕様と違う場合は、古い挙動をそのまま復活させたりユーザーへ二択で返す前に、最新 `develop` と現在の指示へ改善意図を適応できるか調べる。両側の差分を確認し、無条件の ours / theirs 採用やテスト削除で解決しない。

| 状況 | 対応 |
| --- | --- |
| 可逆的な見た目・操作感・文言 | AI が選択・記録して DEV で確認 |
| 現仕様へ適応できる古い PR / 技術競合 | AI Repair で修復・検証して Integration へ戻す |
| DEV 上のユーザー指摘 | 公開 SHA・対象画面・再現条件を現在状態と照合し次の修正へ反映 |
| hold / Changes requested / unresolved thread / dependency | 既存制御を維持 |
| 未承認の不可逆データ変更、互換性を壊す save/schema/protocol、既存要件から決められない重大契約 | その対象だけ human-required |
| Repair attempt 上限到達 | 有限 retry を維持して停止し、原因・試行・次の復旧手段を残す |

技術的に難しい、同じ file を変更している、任意の目視確認がまだ、という理由だけで human-required にしない。一方、明示的な権限不足、実際の互換性破壊、既存 review / hold、キャラクター等の明示 visual approval / `RUNTIME_READY` 条件は推測で解除しない。

DEV の人間目視と、自動 browser 検証・Production 品質認定は別。テスト、browser assertion、exact-head review、claim/attempt、main / Production gate を弱めない。

## Ready handoff

GitHub の `open + base=develop + draft=false` が通常 handoff の境界。exact head の `implementation/handoff` status / PR comment は受領記録であり、独自 Task-ID や別の永続 queue を追加しない。

通知・status は工程別に扱う。

| 工程 | GitHub 正本 | 通知 |
| --- | --- | --- |
| 作業中 | work branch / Draft PR / current commit | 開始・push 到達。最終成功ではない |
| 実装完了 | Ready PR / exact head / `implementation/handoff` | `READY_FOR_INTEGRATION` |
| develop 統合 | merged PR / merge commit / Integration status | `INTEGRATED` |
| DEV 完了 | target develop SHA の `integration/develop=success` | `DEV_DEPLOYED` |
| 実装失敗 | branch / commit / Draft or hold / reason | `FAILED` |

通知は既存の設定済み経路を再利用する。`NTFY_TOPIC_URL` / `NTFY_TOKEN` が未設定・送信失敗なら GitHub 側へ記録し、スマホ到達を確認済みと報告しない。通知成功は code / CI / DEV 成功の証拠ではなく、通知失敗も実装失敗には置き換えない。ChatGPT アプリ自身の push / 応答表示は完了判定に使わない。

通常 Chat / WORK 全体を監視する汎用 heartbeat daemon があるとは扱わない。Repair/Rescue 固有の lease / watchdog はその実装範囲だけに適用する。

## 失敗と復旧

単発確認時に即時失敗が判明し、その場で安全に直せる場合は同じ branch / PR で修正 → 高速検証 → push → Ready まで進めてよい。後から判明した失敗は Integration が exact head、失敗 run、対象 test/log を根拠に Repair へ返す。修正 worker も Ready で終了する。

セッション停止時は、過去チャットから再構築せず、次の現在状態から同じ PR を復旧する。

- repository / branch / exact head SHA
- PR URL / Draft or Ready / base
- `implementation/handoff`
- 必要な Integration / DEV status
- exact-head Checks / run / artifact
- 最新 `develop` との差分

Ready 済みなら、修正依頼なしに CI 待機セッションを再開しない。

GitHub 反映経路は **通常 git → 接続済み GitHub API → 同 Repository の既存 Codespaces + 通常 git**。1経路の認証・通信・転送制約だけで不能と結論付けない。詳細は [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md)。

browser repair は [`BROWSER_SELF_HEALING.md`](BROWSER_SELF_HEALING.md)、Integration Repair は [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md) に従う。

## 転送・push の既存承認

依頼作業に必要なコード、モデル、VRM/GLB、Blender/DCC 元データ、文書、検証証拠、Git bundle を `charukun/soul-lineage` と同 Repository の既存 Codespaces 間で転送し、依頼された work branch を commit/push、PR 作成・更新する範囲は既存承認済み。詳細な許可範囲と例外は [`DELIVERY_AUTHORIZATION.md`](DELIVERY_AUTHORIZATION.md) を正本とし、同じ許可を再質問しない。

この承認は、無関係なデータ、別 Repository / account / provider、新規課金、credential/security 変更、破壊的操作、実装 worker による develop merge、main / Production 公開を許可しない。

## 完了報告の画像・動画エビデンス

作業依頼への完了報告では、実際に確認した結果のキャプチャーまたは動画をユーザーへ見せる。画像・動画の保存だけ、PR URLだけ、テスト成功の文章だけでは視覚エビデンスの提示完了としない。

- 見た目の変更は変更箇所が分かるキャプチャー、移動・戦闘・アニメーション・操作の変更は該当操作の動画を優先する。比較が必要なら同じ条件の変更前後を添える。
- 文書・基盤など画面を変更しない作業は、実際の検証結果や変更結果のキャプチャーを使い、ゲーム画面の確認とは区別する。無関係なタイトル画面や生成した見本画像を実証拠にしない。
- 対象SHA、確認環境（local PR preview / deployed DEVなど）、画面・操作、結果、未確認範囲を証拠と対応づける。PR headの録画をDEV公開確認として扱わない。別SHAの証拠の使い回しは禁止。
- 最終応答では代表画像をインライン表示するか、動画を再生可能な添付で提示する。保存済みの証拠・PR報告へのリンクも添えられるが、リンクだけで代替しない。トークン・個人情報等が映り込む場合は撮影範囲を限定する。
- 局所検証時に撮影できるものはReady前に取得する。非同期CIの証拠はIntegration側が対象PR/headへ追記する。取得待ち・環境制約・失敗の場合は `未取得` と理由・担当経路を明記し、画像を見せた／動作を確認したとは報告しない。
- Ready / `READY_FOR_INTEGRATION` は引き続き実装の終了境界。証拠待ちでCIをpollingしない。browser assertion、review、main / Productionの品質gateを弱めない。

### 取得・報告の実装

PRの `Affected browser smoke` は対象操作のスクリーンショットと動画を `test-results/pr-browser/` に保存し、同じrunの `completion-evidence.json`・`README.md`・`index.html` にまとめる。検証失敗時の撮影も診断用として残す。続く `Report completion evidence` はtrusted developから実行し、current PR headが一致する場合だけ撮影件数・保存先・保存期限・未取得状態をPRへ追記する。Readyの受領やmergeはこのjobを待たない。

ローカルで撮影した画像・動画も、専用の空ディレクトリに保存して次で整理できる。

```sh
npm run completion:evidence -- test-results/completion <撮影した40桁SHA> success "local validation" "確認した画面・操作"
```

SHAは現在checkoutと一致させる。CIではplaytest receiptのSHAも照合し、前回の撮影ファイルは撮影開始時に除去する。画像の形式・空ファイル・サイズ上限を検査するが、画像内容が依頼を満たすかは実際に画像を開いて確認する。汎用smokeだけで依頼固有の動作まで確認済みとしない。

GitHubの保存先はログインが必要なActions artifact（14日保存）のZIP。展開後の `index.html` で画像表示・動画再生ができる。artifact自体はチャットへのインライン表示でも永続保管でもない。最終応答を作るworkerは必要ファイルだけ取得して直接表示し、利用環境の永続添付へ保存する。CI結果がセッション終了後に届く場合はPRへの追記までが自動処理であり、終了済みチャットへ画像が自動追加されるとは報告しない。期限切れの証拠は取得済みと扱わず、必要時に同SHAで再取得する。

## 最終応答

通常実装の最終応答には最低限、次を含める。

- 実装完了内容
- branch
- exact head commit SHA
- PR 番号 / URL
- Ready for review 化済み
- `READY_FOR_INTEGRATION`
- 実行した高速検証
- 上記のキャプチャー／動画と短い確認内容、または未取得理由と非同期の証拠追記先
- CI / handoff recorder / 通知が未確認または実行中なら、その事実

CI・browser・通知完了を待って最終応答を遅らせない。

## 優先順位

この Repository 内の最新版が現行正本。添付、Project Sources、過去チャット、古い SHA の `RINNE_PROJECT_EXECUTION_POLICY` と差がある場合は、最新 `develop` のこの文書と現在の GitHub 状態を優先する。資料全体の優先順位は [`README.md`](README.md) を参照する。
