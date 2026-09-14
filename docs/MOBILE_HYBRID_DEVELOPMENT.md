# スマホ完結ハイブリッド開発

通常作業は既存WORKを使います。反映経路はChat/WORK/Codexから通常git、利用可能なGitHub連携/API、Codespaces＋通常gitの順です。1経路が失敗しただけで停止せず、同じ作業branchと成果物を維持して次の経路へ切り替えます。Integration、CI/CD、DEV高速開発ポリシーは変更しません。

## 基本ルール

1. 最新`develop`から作業branchを作成し、コード修正前のpush・Draft PR作成を経て実装・高速検証・push・Ready化まで進め、CI完了を待たず報告して終了する。
2. push前に `node scripts/check-push-route.mjs origin/develop HEAD` を実行する。
3. `PUSH_ROUTE=WORK_CONNECTOR_OK` は連携でも搬送可能という意味です。通常gitが利用可能なら通常gitを優先します。
4. `PUSH_ROUTE=CODESPACES_GIT` は連携APIでBase64搬送を再試行せず、スマホのGitHub Webから対象branchのCodespaceを開き、通常`git push`へ切り替える。
5. `PUSH_ROUTE=LFS_REQUIRED` は100 MiB超ファイルがあるため、そのままpushしない。Git LFSまたは適切なasset配布方式へ移す。
6. 連携APIで容量・Base64・payload上限系エラーが1回出た場合も、サイズ判定にかかわらず再試行せずCodespacesへ切り替える。
7. Codespacesはpush経路の代替であり、merge先やPR運用を変えない。PRはdevelop向け、merge・DEV公開は既存Integrationへ引き継ぐ。
8. main / Productionは変更しない。

## 書き込み経路の確認順（停止しないための必須ルール）

**Chatから起動されたWork/Codex環境では、通常gitによる直接pushを第一の正式経路**とします。CLIの `git push` が認証エラーになっても、Repositoryへの書き込み権限がないとは判断しません。実装WORKは、PR作成前に次の順で利用可能な経路を確認します。

1. Chatから起動されたWork/Codex環境で、作業branchへ通常gitで直接pushする。
2. その環境のGitHub連携（branch・commit・PRを直接作成できる経路）が利用可能なら、通常git direct pushと同じ正式な書き込み経路として使う。
3. 大きなファイル、Base64/payload上限、または上記の書き込み経路が使えない場合だけ、同じbranchをCodespacesで開いて通常git pushを使う。

一つの経路が失敗しただけで、作業を「認証待ち」「手動対応待ち」として止めない。利用可能な次の正規経路へ切り替え、実装・検証済みのbranchと差分を維持したままReady PRまで進める。

## Codespacesでの最短手順

```sh
git fetch origin
git switch <既存の作業branch>
git pull --ff-only
npm ci
node scripts/check-push-route.mjs origin/develop HEAD
node scripts/validate.mjs fast origin/develop HEAD
git status
git push -u origin HEAD
```

スマホではGitHubのRepository画面からCodespacesを開き、ブラウザ版VS CodeのTerminalを使います。`.devcontainer/devcontainer.json` によりNode 24と`npm ci`が用意されます。

## 大きいassetの扱い

GitHub通常Gitでは50 MiB超で警告、100 MiB超は拒否されます。100 MiB未満でも、巨大GLB/VRM/音声/動画を多数Repositoryへ直接積むとclone・CI・Pages配信が重くなるため、単なる連携回避だけを理由に無制限にGitへ入れません。50 MiB超はLFS化またはasset配信分離を検討します。

## WORKへの指示

WORKは大きなファイルをGitHub連携APIで分割・Base64化して無理に送信しません。`check-push-route`がCodespacesを指示した場合、実装成果と作業branchを維持して、利用可能なCodespaces＋通常git経路でcommit/pushまで進めます。push経路の違いで実装をやり直しません。

## Integrationとの関係

Codespacesからpushされたbranchも通常PRと同一扱いです。Ready化後の既存`ci.yml`の結果監視はIntegrationへ引き渡す。実装セッションはCIを反復ポーリングしない。Ready PRは既存Integrationが依存・レビュー・競合を確認してdevelopへ統合します。Integrationは影響範囲の高速検証・DEV公開・公開HTTP/source照合を担当します。重い全体検証・実ブラウザ・P2Pは必要時に別jobで実行します。
