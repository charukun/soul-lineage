# Integration Fast Lane

## 目的

通常の develop Integration は爆速を最優先し、1件の失敗や DEV 公開/browser 検証を理由に独立した Ready PR 全体を停止しない。

## 通常経路

```text
Ready PR
  -> exact-head fast check
  -> eligible なら serialized writer が即 merge
  -> develop push
  -> DEV Publisher は最新 develop を非同期公開
  -> browser/public smoke は非同期で repair ticket を更新
```

### merge 前に残す条件

- open / non-Draft / base=develop
- same repository / trusted author
- explicit hold なし
- Depends-On 完了
- mergeable
- unresolved review / Changes requested なし
- current exact head の `Validate and build` 成功と `pr-fast-<PR>-<SHA>` artifact
- control-plane / overlapping scope は既存 exact-head review 条件を維持

`Affected browser smoke`、`integration/develop`、DEV 公開完了は通常 PR の merge 条件にしない。browser failure はその PR / develop の repair に送り、別の eligible PR を止めない。

## develop / DEV

`integration/develop` は DEV delivery health の観測値であり、通常 merge lane の global lock にしない。DEV Publisher は develop の古い snapshot を順番に処理せず、開始時点の最新 develop へ収束する。公開後の HTTP/source/browser 検証は維持し、失敗時は repair ticket を作る。

## 例外

main / Production の品質 gate は変更しない。explicit hold、review objection、dependency、merge conflict、exact-head fast failure は引き続き対象 PR を停止する。停止単位は原則 PR 単位とし、他の独立 PR を巻き込まない。

## 受入条件

- PR A の exact-head fast check が失敗していても、PR B が条件を満たせば B は merge できる。
- `integration/develop=pending|failure` でも通常 Ready PR の評価と merge が進む。
- browser smoke が running / failure でも `Validate and build` 成功済み exact head は merge 候補になれる。
- develop mutation は引き続き single writer / expected-head で直列化する。
- DEV 公開は非同期で最新 develop へ収束する。
- main / Production の blocking browser / quality gate は維持する。
