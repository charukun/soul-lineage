# Browser playtest routing

ユーザーが「実際にプレイして」「実際に操作して」「触って確認して」など、ブラウザ上での実操作を明示した場合は、現在のChat / WORK環境にローカルブラウザがないことを理由に確認不能としない。RepositoryにあるPlaywright / GitHub Actions / DEV public browser経路へ要求を引き継ぎ、実ブラウザ入力の証拠をGitHubに残す。

## 目的

- 実装者の実行環境にChromiumやComputer Useがなくても、実操作要求を失わない。
- 「コードを読んだ」「DOM/CSSを確認した」と「実ブラウザで操作した」を明確に区別する。
- PRの影響ファイルだけでは表現できない、ユーザー指定のアプリ横断プレイ確認を機械可読にする。
- 既存のFast Lane、browser self-healing、DEV publication / full verificationを再利用し、新しい常駐workerや独自queueを作らない。

## PR契約

コード変更タスクで実ブラウザ操作が明示された場合、Draft PRの本文にReady化する前から次の行を1行だけ含める。

```text
Browser-Playtest: all
```

または対象を限定する。

```text
Browser-Playtest: rinne,village,demon
```

許可値は `all`、`affected`、または `rinne,village,demon` の部分集合。`affected` は通常の差分ベースbrowser smokeを明示する値であり、ユーザーが3アプリすべてを指定した場合は `all` を使う。

PRの `Affected browser smoke` はGitHub event上のPR本文からこの値を読み、PR差分から得た対象へ加算する。したがって、差分が1アプリだけでも `Browser-Playtest: all` なら3アプリの実ブラウザplaythroughを実行する。未知のアプリ名、重複した `Browser-Playtest:` 行、空値は契約違反としてbrowser gateを失敗させる。

PR browser artifactには対象・要求・実行結果を示す `playtest-receipt.json`、各アプリのスクリーンショット、trace、console/network診断を残す。`Browser-Playtest:` の指定自体はFast Laneを同期待機させない。失敗は既存のbrowser self-healingへ渡す。

`Browser-Playtest:` はReady前に確定する。Ready後に対象を変える場合は、同じPRで新headをpushするかDraft→Readyをやり直して通常browser runを再起動し、本文だけを書き換えて検証済みと扱わない。

### playthroughのブラウザ隔離

同じアプリで「起動/WebGLの軽量probe」と「保存・タイトル復帰を含むfull playthrough」を連続実行する場合、probe用BrowserContextを閉じてからfull playthroughを開始する。二つのruntimeを同時に生かしたまま同一originの保存・exclusive-tab・lifecycle状態を競合させない。これは検証を弱めるためではなく、各playthroughを実ユーザーの単一タブ起動に近い独立セッションとして成立させるための隔離条件である。

### 一時的に隠れるHUDをready判定に使わない

起動直後の演出やゲーム状態によって意図的に隠れる常設HUD要素を、playthrough開始条件へ使わない。たとえば輪廻転焦の出生期は `data-birth-tour=true` の間、右上の目的カードを隠し、母との会話・頭上の短い状態表示・実際の村巡りで導入する。この状態で `#objective` の可視化を待つことは、現在のUI契約ではなく旧HUDを要求することになる。

playthroughのready判定は、runtimeがactiveであること、loadingが消えたこと、canvas / 現在状態で利用できる主要操作が成立していることを基準にする。後続の各phaseでは目的テキストや状態値そのものを引き続き検証してよいが、現在の仕様で隠すことが確定した旧操作や一時的HUDを表示させたりforce clickして検証を通してはいけない。

## PRを伴わない現在developの確認

コード変更なしで現在のdevelopを実際に触って確認する場合は、新しいworkflowを増やさず既存の `Deploy DEV and PROD` workflowを `ref=develop`, `full_verification=true` でdispatchする。この経路は現在のdevelopをDEVへ整合させたうえで、`INTEGRATION_FULL=true` のpublic Chromium / WebGL2検証を全DEV targetへ実行し、既存artifactとstatusへ証拠を残す。必要なP2P診断も既存full verificationに含まれる。

ローカルブラウザが利用可能なら同じシナリオをローカルで先に実行してよいが、ローカルブラウザの有無はRepository playtest経路の可否とは無関係。別のChatGPTモードへ切り替えることを標準経路にしない。

## 報告用語

- コード/DOM/CSSだけを確認した場合: `static review`
- PR headをGitHub Actionsまたは同じPlaywrightシナリオでChromium実入力まで完了した場合: `browser playtest`
- develop公開後のpublic URLでbrowser verificationが完了した場合: `DEV browser verified`

実装WORKはCIを待機・pollingしないため、Ready時点でbrowser runが未完了なら `browser playtest handed off` と報告する。`browser playtest` 完了済みと断定するのは、対応するexact-head run/artifact成功を確認できた場合だけとする。`static review` を `browser playtest` と言い換えない。

## 既存経路との関係

- コード変更あり: Draft PR + `Browser-Playtest:` → 実装 → fast validation → Ready → PR browser smoke → Integration
- コード変更なし: existing `deploy.yml` → `full_verification=true` → current develop public browser diagnostics
- browser failure: `docs/BROWSER_SELF_HEALING.md` の既存ticket / repairへ
- merge後: DEV Publisher → public browser verification
- main / Production: この契約では変更しない

この仕組みは実ブラウザ確認の経路選択を固定するためのものであり、browser assertion、review、hold、exact-head gate、repair attempt上限を弱めない。
