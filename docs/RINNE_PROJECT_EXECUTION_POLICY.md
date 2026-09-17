# 実装セッション実行ポリシー

この文書は通常 Chat / WORK / Codex 実装セッションの終了境界、通知、証拠、復旧を定義する。実装判断は [`ASTRA_OUTCOME_CONTRACT.md`](ASTRA_OUTCOME_CONTRACT.md) と [`DEVELOPMENT.md`](DEVELOPMENT.md)、Ready後のmerge / DEV公開は [`INTEGRATION.md`](INTEGRATION.md) を正本とする。

## 正本と3状態

実装の正本は `charukun/soul-lineage` の最新 `develop` と current GitHub state。Chat / WORK / Codex は一時的な実行環境であり、永続CI監視workerではない。

worker-facing stateは次だけ。

| Outcome | 意味 |
| --- | --- |
| `WORKING` | Astra が implementation / semantic reconciliation / validation choice を所有 |
| `READY` | final reconciled exact head + sufficient evidence + pushed source が揃い Integration へ handoff 済み |
| `BLOCKED` | repository contract + user intentだけでは安全に解けない product / permission / external-input choice |

DraftはoptionalなGitHub可視化手段。Micro Patch / Normal / Repairはworker-facing lifecycle stateではない。

## 終了境界

通常実装は次で終了する。

```text
WORKING
  -> current develop と意味的にreconcile
  -> final exact headに必要十分なevidence
  -> push exact validated head
  -> READY PR
  -> READY_FOR_INTEGRATION
  -> final response / session ends
```

reconcile前のvalidationとreconcile後のrevalidationを固定二重工程にはしない。途中検証はデバッグ上必要なら自由に行い、品質上必須なのは **最終 reconciled head の必要十分な evidence**。

Ready化直前にcurrent developを再確認する。developが進んでいればdriftをreconcileし、そのdriftが影響するevidenceだけ再実行する。true conflictは task intent + current develop contract から意味的に解き、blind ours/theirsやgate弱体化で通さない。

checkoutがあれば `npm run pre-ready:sync` / `npm run pre-ready:verify` を補助に使える。helperは意味判断の代わりではない。checkoutがなければconnected GitHub/API routeで同じ ancestry/evidence 契約を満たす。

## Ready後は待たない

CI / GitHub Actions / Playwright / browser check が Running / Queued / Pending でも implementation session は待たない。`gh run watch`、`gh pr checks --watch`、一定間隔のActions API取得、sleep loopは禁止。

push直後またはReady直後に current exact head の起動・即時失敗を1回確認するのはよい。未完了ならそのまま handoff する。

Ready後の責任:

- exact-head deterministic checks/build
- current-state re-fetch
- expected-head/CAS merge
- Ready後の短い develop race / mechanical Fast Repair
- DEV publication / source verification
- later semantic repair request

これらはIntegrationまたは専門routeが所有する。workerが「裏で追跡中」を理由に返答を保留しない。

## 工程名

| 状態 | 意味 |
| --- | --- |
| `READY_FOR_INTEGRATION` | Outcome `READY` のhandoff通知 |
| `INTEGRATED` | exact source PRがdevelopへ統合済み |
| `DEV_DEPLOYED` | target develop SHA のDEV公開・source verification成功 |
| `FAILED` | task outcomeを作れず、current recovery情報を残した |

`READY_FOR_INTEGRATION` はCI成功、merge、DEV公開成功を意味しない。

## AI判断と human-required

Astraは明示要件・禁止事項・current developを守る範囲で、可逆的な見た目、操作感、文言、実装方法、validation scopeを選ぶ。重要な仮定だけPRに短く残す。

古いPRや競合を扱うときはcurrent stateへ意図を適応し、無条件ours/theirs採用やテスト削除で解決しない。

`BLOCKED` / human-requiredにしてよい例:

- compatibilityを壊すschema/save/protocol/APIで許容方針がない
- 未承認credential/security/paid resource/Production操作
- current contractsでは優先順位を決められない矛盾要件
- 契約上必須なuser visual approval / irreversible approval

次だけではBLOCKEDにしない: same-file競合、develop advance、merge conflict、技術的難しさ、任意visual未確認、CI pending、mechanically repairable dependency/base drift。

## Ready handoff

GitHubの `open + base=develop + draft=false` が通常handoff境界。Ready exact headについて最低限次を残す。

- repository / branch / exact head SHA
- PR URL / Ready
- reconciled develop SHA
- final headに対して実行したevidence
- 未確認事項
- `READY_FOR_INTEGRATION`

独自Task-ID、第二の永続task DB、heartbeat queueを追加しない。

通知/statusは工程別に扱う。

| 工程 | GitHub正本 | 通知 |
| --- | --- | --- |
| observable WORKING | work branch / optional Draft PR | 開始・push。最終成功ではない |
| READY | Ready PR / exact head | `READY_FOR_INTEGRATION` |
| develop統合 | merged PR / merge commit | `INTEGRATED` |
| DEV完了 | target develop SHA のdelivery success | `DEV_DEPLOYED` |
| BLOCKED / failed | branch / PR / exact head / reason | blocker と再開条件 |

通知は既存設定済み経路を再利用する。通知成功はcode/CI/DEV成功の証拠ではなく、通知失敗もimplementation failureには置き換えない。

## 失敗と復旧

Ready前に即時失敗が分かり安全に直せるなら同じbranch/PRで修復し、current developとreconcileした final headを検証/pushしてREADYへ進める。

Ready後のsource failureやsemantic conflictは同じsource PRを `WORKING` に戻す。復旧workerはrecorded SHAを盲信せずcurrent PR head / latest developから再開する。

セッション復旧に必要な正本:

- repository / branch / current exact head
- PR / Draft or Ready / base
- latest develop / reconciled develop
- exact-head checks/artifactsで必要なもの
- hold / dependency / unresolved review
- last known evidenceとfailure reason

過去チャット全文や全CIログを復旧の正本にしない。Ready済みなら修正依頼なしにCI待機sessionを再開しない。

GitHub反映経路は通常git → connected GitHub API → 同Repositoryの既存Codespaces + 通常git。1経路の認証/通信/転送制約だけで不能と結論付けない。詳細は [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md)。

## 既存承認

依頼作業に必要なcode/assets/docs/evidenceを `charukun/soul-lineage` と同Repository既存Codespaces間で転送し、work branchへcommit/push、PR作成・更新、current developをwork branch側へreconcileする範囲は既存承認済み。詳細は [`DELIVERY_AUTHORIZATION.md`](DELIVERY_AUTHORIZATION.md)。同じ許可を再質問しない。

これは無関係データ、別Repository/account/provider、新規課金、credential/security変更、破壊操作、implementation workerによるdevelopへのmerge/write、main / Production公開を許可しない。

## 完了報告の画像・動画エビデンス

実際に確認した画像・動画がある場合は最終報告でユーザーへ見せる。取得していないのに見た・確認済みとは報告しない。

- 見た目変更: 変更箇所が分かるcaptureを優先
- animation / combat / movement / interaction: 該当操作のvideoを優先
- 文書 / control-plane: test、diff、workflow stateを証拠としてよく、無関係なgame画面を要求しない
- evidenceはexact SHAと確認環境に結び付ける。別SHAの使い回し禁止
- browser evidenceが契約上必要ならReady前に取得する。環境制約で未取得ならその事実を報告する
- evidence待ちを理由にCI pollingしない

通常develop PRではbrowser evidenceを常時自動実行しない。明示playtest、`full_verification=true`、専門workflow、main/Production gateの契約に従う。

## PULSE

PULSEも利用者向けに `WORKING / READY / BLOCKED` を優先する。Fast Lane、Repair、Reconciliation、CI stageはtechnical detailへ下げる。

PULSEはcurrent GitHub stateで観測できるものだけを表示する。Draftを使わない短寿命workerを推測せず、表示のために第二task DB/heartbeatを導入しない。

## Production

main / Productionはユーザーが明示的に依頼した場合だけ変更する。Outcome ContractはProductionのtest/full regression、blocking browser、review、source verification等の品質gateを短縮しない。
