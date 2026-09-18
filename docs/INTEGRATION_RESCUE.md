# Integration Repair

旧称 Integration Rescue。現在の通常経路では独立したRescue queueを持たず、**Fast Lane + Fast Repair + owner-notified normal Chat handoff** を正本とする。

Ready PRのmerge判定は `scripts/integration-fast-lane.mjs` がcurrent GitHub stateから行う。RepairはFast Laneでそのまま通せないPRのうち、機械的に安全性を証明できる更新だけをGitHub Actionsで処理する。Repair自身はdevelopへmergeしない。

## 現行トポロジー

```text
GitHub event
  -> Fast Lane
       eligible -> expected-head merge
       mechanically repairable -> Fast Repair (GitHub Actions)
          -> declared dependency mergeがPR head ancestryに未取り込みのときだけPR branch merge-forward
          -> declared dependency mergeが既に取り込み済みならbranch pushなし
          -> exact-head DEV checks/build (tests=0)
          -> Fast Lane wake
       semantic conflict / source-level DEV check repair
          -> one open Chat Repair incident per source PR
          -> first owner-action-required transition only: GitHub notification / email route
          -> later head/develop changes: refresh the same Issue without owner re-notification
          -> user manually starts normal Chat
          -> same PR repair -> Fast Lane
       true unresolved product decision -> HUMAN_REQUIRED
```

正常PRはRepairを通らない。1件の失敗PRやDEV delivery failureは独立PRをglobal blockしない。通常developの自動テストとbrowser verificationは実行せず、自動Repair laneの入力にも使わない。large-base reconciliationはcomplete fail-closed comparisonでFast Laneに残し、変更量だけを理由にChat repairへ落とさない。

## 実装

| 構成 | 実装 | 責任 |
| --- | --- | --- |
| Fast Lane | `scripts/integration-fast-lane.mjs` | current Ready PR再取得、complete base comparison、exact-head gate、expected-head merge、真のconflict・exact-head DEV check/build failureのhandoff |
| Fast Repair | `scripts/integration-repair-fast.mjs` | Depends-On・review・hold・thread・head・developを再確認し、未取り込みのdeclared dependency mergeがある場合だけ元PR branchをmerge-forward。依存取り込み済みの単なるdevelop進行ではbranchを更新しない |
| Repair workflow | `.github/workflows/integration-rescue.yml` | Fast Repair、test-free exact-head DEV checks/build、Fast Lane wake |
| Chat Repair handoff | `scripts/integration-deep-repair-handoff.mjs` | source PRごとにopen Chat Repair incidentを1件維持し、current exact-head座標を更新。owner通知はincident開始時だけ |
| Deep Repair finalization | `scripts/integration-deep-repair-finalize.mjs` | 修復PRのdevelop merge後に同Issueをcompleted/closeしstatusをfinalize |
| Legacy rescue compatibility | `scripts/integration-rescue-*` | 旧stateの互換・診断・移行のみ。Work起動権限を持たない |
| PULSE | `ops-board/rescue.mjs` 等 | 観測のみ。merge/Repair権限を持たない |

## Fast Repairの対象

Fast Repairは、依存PRのmerge後にその依存mergeをまだ含んでいないstackへ取り込むなど **機械的に安全性を証明できるstack/base更新** を担当する。declared dependency mergeが一度PR head ancestryへ入った後は、無関係なdevelop更新を追い掛けて同PR branchへmerge-forwardし続けない。以後のbase driftはFast Laneのcomplete fail-closed comparisonで判定する。

1. current open/non-Draft develop PRをGitHubから再取得する。
2. same repository / trusted author / 必要なDepends-On条件だけを見る。
3. declared dependency PRがmergedであることと、その `merge_commit_sha` がPR exact headのancestryに入っているかを再確認する。
4. hold、Changes requested、unresolved thread、head変更、dependency、mergeabilityを再確認する。
5. develop SHAとPR exact headをmutation直前に再取得する。
6. 未取り込みのdeclared dependency mergeがある場合だけ元PR branchへ通常merge-forwardする。全依存mergeが取り込み済みならbranch mutationを行わない。force push/history rewriteはしない。
7. branchを更新したheadをtrusted GitHub runnerで `scripts/validate.mjs dev` に通し、**自動テストなし**でexact-headのstatic checks / code-health / build証拠を作る。
8. 更新したheadだけFast Laneをwakeする。依存取り込み済みでbranch mutationが不要だったscanは追加wakeしない。

Fast Repairは意味的な同file衝突を推測で解かない。HTTP 409 / `mergeable=false, dirty` などで機械的に安全なmerge-forwardが成立しない場合は、同じsource PRのChat repair handoffへ送る。

Fast Repair workflowには `stack-browser`、Playwright/Chromium install、`pr-browser-*` artifact、browser repair recorder dispatchを置かない。browserは通常Repairの仕事ではない。

## 意味的競合の通常Chat handoff

Fast Laneがcurrent exact headの真の競合、またはsource-level修復が必要なexact-head DEV check/build failureを確定した場合、そのsource PRに未解決のopen Chat Repair incidentがなければGitHub Issueを1件作り、ownerへ起動通知する。すでに同じsource PRのopen incidentがある場合は、新しいIssueを作らず、そのIssueのcurrent exact-head/develop/reasonを更新する。

Issueは次を含む。

- `integration-deep-repair:v1` のsource PR/head/develop/state
- `chat-repair:v1` のnormal-Chat execution契約
- 互換の `rinne-ai-repair:v1` envelope
- PR URL、recorded head/develop、reason、必要ならfailed run/job identity
- normal Chatへそのまま貼れる復旧prompt
- incident開始時だけowner assignment / mention

通知identityと検証identityを分離する。**通知identityはopen source PR repair incident単位**、検証identityは引き続き `sourceKey=pr:<N>:head:<SHA>` のexact-head単位とする。headやdevelopが動いても同じ未解決PRなら同Issue内のmarkerをcurrent座標へ更新し、owner mention / assignmentを再送しない。これによりexact-head safetyを維持したまま、修復pushのたびに新しいメールが増殖することを防ぐ。

同じexact-head generationの再評価ではIssue bodyも再通知も増やさない。前generationが `ready-for-integration` / `pending` でcurrent head/developが変わった場合は同Issueを `pending` のcurrent generationへ更新する。`working` claim中は別generationで上書きせず、`human-required` / attempt上限 / completedを自動解除しない。旧Work時代のIssueを発見した場合は同IssueへChat handoffを追加して移行し、別Issueを増やさない。

GitHub Issue/mention/assignmentは既存GitHub通知経路を使う。メール配送はownerのGitHub通知設定に従い、独自SMTP・外部メール配信サービス・通知queueは追加しない。ownerへの起動メールは同じopen repair incidentで1回だけを意図し、exact-head refreshはIssue更新だけで行う。

通知を受けたユーザーが**通常Chatを手動開始した場合だけ** semantic repairを行う。通常Chatはメールやrecorded SHAを正本にせず、current PR headとlatest developを再取得する。PR側とdevelop側の意図、関連契約・テストを読み、両立可能な目的は双方残す。無条件ours/theirs、blind cherry-pick、assertion削除、gate弱体化は禁止。

通常Chatの修復先は既存source PR branchだけ。通常git → 接続済みGitHub API → 必要時だけ同branchの既存Codespaces＋通常gitの順で反映する。局所test/check/build後に同PRをReady / `READY_FOR_INTEGRATION`へ戻し、CI/DEV完了は待たない。

## Work / Codex / APIは使わない

Integration復旧は ChatGPT Work、Codex、OpenAI API、追加の有料モデルAPI、専用PATを起動条件・fallback・watchdogに使わない。

旧 `docs/INTEGRATION_RESCUE_WORK.md` と `integration-rescue-work-*` は互換・履歴参照用であり、現在の実行経路ではない。旧 periodic Work / event Work を再作成・再有効化しない。

## HUMAN_REQUIRED

次は自動で片側を捨てず、そのPRだけを停止する。

- explicit hold / `integration:manual` / `do-not-merge`
- Changes requested / unresolved review thread
- external/untrusted PR
- main / Production
- current repository contractsから解けないschema/save/protocol/API等の真のproduct choice
- assertion意図を維持できずcoverageを落とすしかない修復

同file競合・技術的難しさ・目視未確認だけではhuman-requiredにしない。確定仕様への適応と可逆的な細部は通常Chatが判断し、通常gateで検証する。

## tests / browser / DEV

通常develop PRとFast Repairでは自動テストを実行しない。通常DEV publicationでもbrowser verificationを自動実行しない。テスト資産は保持し、実装セッションの局所テスト、明示playtest、`full_verification=true`、専門evidence workflow、main / Productionで使う。

明示browser failureがtrue source semantic repairを要求する場合はnormal-Chat handoffへ寄せる。機械的なbrowser evidenceの再実行を通常Fast LaneやFast Repairへ混ぜない。過去のbrowser repair stateは履歴証拠として残してよいが、新しい通常develop Repairの入力にはしない。

DEV PublisherはFast Laneから分離しlatest developへcoalesceする。normal DEV成功条件はcandidate manifest / public HTTP/source verificationであり、main / Productionの既存test/browser gateは変更しない。

## 旧Rescue state

`automation/integration-rescue-state`、Wave、claim、heartbeat、`AWAITING_PUSH`、Work relay等は旧stateの診断・移行情報として残る場合がある。**current Ready PRのmerge可否、Fast Repair、Chat Repair handoffの権限には使わない。**

## 安全条件

- current exact-head DEV check/build evidenceなしではmergeしない
- explicit hold / review objection / unresolved threadをRepairが解除しない
- current PR/head/developをmutation直前に再取得する
- Fast Laneのsingle develop writerを維持する
- PR branch更新は未取り込みdeclared dependencyの通常merge-forwardまたは通常Chatで局所検証済みの修復だけ。依存取り込み済みの単なるdevelop進行ではbranchを更新しない。force push禁止
- テスト資産・browser assertions・main / Production gateを削除/弱体化しない
- main / Productionを自動Repair対象にしない
- 同じopen source PR repair incidentでowner起動通知を重複生成しない
- exact-head `sourceKey` / status evidenceはhead更新後もcurrent generationへ追従する
- `working` / `human-required` / attempt上限をhead変更だけで自動解除しない

## 受入条件

- 正常Ready PRは旧Rescue stateやWorkを通らずmergeできる
- mechanically repairableなstackでdeclared dependency mergeがPR head ancestryに未取り込みなら、GitHub Actionsだけで1回のmerge-forward・test-free DEV checks/build・Fast Lane wakeまで進む
- declared dependency mergeが既にPR head ancestryへ入った後のdevelop進行では、Fast Repairが同PR branchを再pushせず、同じ `Merge develop into ... after dependencies ...` 通知を増殖させない
- dependency取り込み済みのbase driftはFast Laneのcomplete fail-closed comparisonで安全性を判定する
- 真のsemantic conflict / source-level DEV check/build repairはsource PRごとに1件のopen owner通知Chat Repair incidentへhandoffされる
- 同じ未解決PRのhead/developが更新されても新しいIssue/owner mention/assignmentを増やさず、同Issueのexact-head markerだけをcurrent generationへ更新する
- Issueメールには通常Chatへ貼るpromptが含まれ、修復時はcurrent GitHub stateを再取得する
- 両側の互換な意図を保持し、片側丸捨てを自動化しない
- normal develop tests=0 / browser opt-in、Production品質gateは不変
- Work / Codex / OpenAI API / paid fallbackなし
- Chat repair待ちでも独立eligible PRはmergeできる
- main / Production gate不変
