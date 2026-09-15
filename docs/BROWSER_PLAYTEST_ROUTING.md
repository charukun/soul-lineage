# Browser playtest routing

ユーザーが「実際にプレイして」「実際に操作して」「触って確認して」など、ブラウザ上での実操作を明示した場合は、現在のChat / WORK環境にローカルブラウザがないことを理由に確認不能としない。RepositoryにあるPlaywright / GitHub Actions / DEV public browser経路へ要求を引き継ぎ、実ブラウザ入力の証拠をGitHubに残す。

## 目的

- 実装者の実行環境にChromiumやComputer Useがなくても、実操作要求を失わない。
- 「コードを読んだ」「DOM/CSSを確認した」と「実ブラウザで操作した」を明確に区別する。
- PRの影響ファイルだけでは表現できない、ユーザー指定のアプリ横断プレイ確認を機械可読にする。
- 既存のFast Lane、browser self-healing、DEV publicationを再利用し、新しい常駐workerや独自queueを作らない。

## PR契約

コード変更タスクで実ブラウザ操作が明示された場合、PR本文に次の行を1行だけ含める。

```text
Browser-Playtest: all
```

または対象を限定する。

```text
Browser-Playtest: rinne,village,demon
```

許可値は `all`、`affected`、または `rinne,village,demon` の部分集合。`affected` は通常の差分ベースbrowser smokeを明示する値であり、ユーザーが3アプリすべてを指定した場合は `all` を使う。

CIはこの値をPR差分から得た対象へ加算する。したがって、差分が1アプリだけでも `Browser-Playtest: all` なら3アプリの実ブラウザplaythroughを実行する。未知のアプリ名、重複した `Browser-Playtest:` 行、空値は契約違反としてbrowser gateを失敗させる。

PR browser artifactには対象・要求・実行結果を示すreceipt、各アプリのスクリーンショット、trace、console/network診断を残す。`Browser-Playtest:` の指定自体はFast Laneを同期待機させない。失敗は既存のbrowser self-healingへ渡す。

## PRを伴わない確認

コード変更なしで現在のdevelopを実際に触って確認する場合は、Repositoryの `Browser Playtest` workflowを手動dispatchし、対象refとアプリを指定する。通常は `ref=develop`, `apps=all`。このworkflowも同じplaythrough実装を使い、artifactを証拠として残す。

ローカルブラウザが利用可能なら同じシナリオをローカルで先に実行してよいが、ローカルブラウザの有無はRepository playtest経路の可否とは無関係。

## 報告用語

- コード/DOM/CSSだけを確認した場合: `static review`
- GitHub Actionsまたは同じPlaywrightシナリオでChromium実入力を完了した場合: `browser playtest`
- develop公開後のpublic URLでbrowser verificationが完了した場合: `DEV browser verified`

実装WORKはCIを待機・pollingしないため、Ready時点でbrowser runが未完了なら `browser playtest handed off` と報告する。`browser playtest` 完了済みと断定するのは、対応するexact-head artifact/run成功を確認できた場合だけとする。

## 既存経路との関係

- 通常PR: Draft → 実装 → fast validation → Ready → PR browser smoke → Integration
- browser failure: `docs/BROWSER_SELF_HEALING.md` の既存ticket / repairへ
- merge後: DEV Publisher → public browser verification
- main / Production: この契約では変更しない

この仕組みは実ブラウザ確認の経路選択を固定するためのものであり、browser assertion、review、hold、exact-head gate、repair attempt上限を弱めない。
