# PULSE v2

PULSE は `charukun/soul-lineage` の開発状況をスマートフォンから確認する read-only control plane です。この文書を PULSE の唯一の仕様正本とします。`ops-board/README.md` は実装入口であり、状態意味を再定義しません。

## 1. 原則

PULSE は GitHub のコピーDBを作りません。GitHub、Cloudflare Worker、公開manifestの事実を読み取り、表示用snapshotを一時的に組み立てます。snapshotやブラウザキャッシュは正本ではありません。

PULSE自身の同期障害と、ゲーム・ツールの公開状態は別レイヤーです。PULSEが最新状態を取得できなくても、管理対象アプリを0件にしたり、公開待ちへ書き換えたりしません。

## 2. 正本

| 情報 | 正本 |
| --- | --- |
| 管理対象アプリと分類 | `scripts/application-catalog.mjs` の `PULSE_SURFACES` |
| DEV公開状態 | current develop SHA の GitHub commit status `dev/<deployApp>` |
| DEV公開URL | `scripts/distribution-targets.mjs` |
| 作業キュー | GitHub の open develop PR |
| CI / Actions失敗 | GitHub Actions |
| staging / Production | 公開 `deployment-manifest.json` |
| PULSE自身の公開 | `dev/pulse` status + `https://rinne-ops.c-okamoto.workers.dev/` |
| PULSE同期ヘルス | `/api/state.syncStatus` |

GitHub Pages の旧 `/dev/` はDEVの正本ではありません。DEVの判定に使用しません。

## 3. 管理対象

PULSEのトップに表示する管理対象は次です。

- product game: `rinne`, `village`, `demon`
- developer tool: `character-studio`, `visual-review`
- reference app: `eclipse`
- control plane: `ops-board` (PULSE)

WAYFINDERや専用previewは詳細情報として保持できますが、DEV App Healthyの母数には含めません。

## 4. DEV状態

DEV状態は次の5種類だけです。

- `success`: current develop SHA に `dev/<app>=success` がある
- `deploying`: current develop SHA に `dev/<app>=pending` がある
- `failed`: current develop SHA に `dev/<app>=failure|error` がある
- `unknown`: current develop SHAのstatusを取得できない、またはstatusが存在しない
- `missing`: staging / Productionなど、正式公開定義そのものが存在しない

`unknown` を `waiting / queued` と解釈してはいけません。QUEUED表示は実際のpending事実がある場合だけです。

## 5. 同期と障害

GitHubイベント後の認証付きrefreshを主経路とします。ブラウザの「再読込」は保存済みPULSE snapshotを読み直す操作であり、ブラウザからGitHub APIを呼びません。

PULSE snapshot、GitHub APIキャッシュ、control historyはDurable Objects永続ストレージを正本にしません。Free tier上限や保存障害がPULSE全体を停止させないことを優先します。peer-world永続データは別責務です。

同期失敗時は以下を守ります。

1. 直近の正常snapshotがあればLast Known Goodとして表示する。
2. Last Known Goodがなくても `PULSE_SURFACES` から管理対象アプリを表示する。
3. 状態が取れないアプリは `unknown` とする。
4. アプリ数、既知URL、分類を0件へ崩さない。
5. 「再同期中」はPULSEヘルスだけに表示し、アプリの公開状態を書き換えない。

## 6. トップ画面

トップは ACTIVE / APPS / ISSUES / RECENT の4区画です。

- ACTIVE: Draft / Ready のopen develop PR
- APPS: 全管理対象のDEV状態
- ISSUES: 実際の失敗と人の確認が必要な項目
- RECENT: merge、DEV公開、PULSE状態変化

トップのApps Healthyは管理対象7件を母数とします。ゲーム3本だけを数えません。

## 7. PULSE公開成功

PULSEのstatic assetが配られただけでは正常とは扱いません。

PULSEを変更したdevelop mergeでは、既存Per-App DEV Publish laneで `pulse` を公開し、その後の認証付きrefreshが `syncStatus=ok` を返すことを要求します。PULSE自身のrefreshが失敗した場合、そのPULSE公開runは成功扱いにしません。

他アプリのDEV公開はPULSE障害によって巻き戻しません。PULSEは観測系であり、ゲーム公開の正本ではありません。

## 8. staging / Production

staging / Productionだけは公開manifestを使用します。DEVと混ぜません。main / Productionの品質gateはPULSE都合で変更しません。

## 9. 禁止

- Pages DEVを復活させる
- snapshotをGitHubより強い正本にする
- 同期失敗を0 Appsとして表示する
- status未取得をQUEUEDにする
- 手書きの別アプリ一覧を増やす
- PULSE障害をゲーム公開失敗として扱う
- main / ProductionをPULSE修復のために変更する
