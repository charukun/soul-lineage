# Platform境界と将来の配信

## 現在の実装範囲

Web Adapterだけを実装しています。iOS / Android / PS5 / Nintendo Switch 2 / Steam / Xboxは将来の接続対象です。この基盤の完成は、コンソールSDK対応・各社認定・ストア審査・実機動作確認が済んだことを意味しません。WebGL / Three.jsの出力をそのまま全Platformへ持ち込めるとは仮定しません。

| 層 | 配置 | 依存可能なもの |
| --- | --- | --- |
| ゲームルール・進行 | `apps/<app>/src/game/`, `src/app.js` | portable package、注入されたPlatform ports |
| 共通データ | `world`, `game-data`, `characters`, `animations`, `assets`, `audio` | ID・JSON・相対asset参照。SDK依存を置かない |
| Platform契約 | `packages/platform` | plain JSと宣言型のみ |
| Web実装 | `platform-web` | DOM、storage、fetch、入力、lifecycle、locale |
| Web表示 | `rendering`, `shared-ui` | Three.js / WebGL / DOM。ゲームルールから分離 |
| 起動時の配線 | 各appの `src/main.js` | Adapterを選択してゲームへ渡す |
| 将来のネイティブ実装 | 対象決定後の `platform-<target>` | 正式なSDK、プラットフォーム固有表示・入力・認証など |

`packages/platform/src/contracts.d.ts` に時計、保存、通信、identity、入力action、suspend/resume、言語・TZの契約を定義しています。Web実装のcapabilitiesはcloudSave/crossPlay/commerceがfalseです。未実装サービスをローカル処理で成功したことにしません。

表示エンジンを交換する場合も、world座標、entity ID、asset ID、animation ID、ゲーム状態をportableに保ちます。今の表示Adapterはプレビュー用WebGLです。ネイティブ側の描画・Asset変換・controller mapping・認証・実績・commerce・entitlement・invite・認定対応は対象SDK決定時に実装します。機密SDKを公開Repositoryへ置きません。

## アプリ固有タイポグラフィ

3ゲームの文字表現は共通の汎用UIフォントへ寄せず、`rinne` / `village` / `demon` がそれぞれの世界観に合わせたWebタイポグラフィを所有します。Web版では各appの入口から専用書体を明示し、本文・HUDと作品名/章見出しの役割をapp内のtypography stylesheetで固定します。

既存の汎用・端末依存スタックを新しいゲームUIへ再導入しません。特に `system-ui`, `-apple-system`, `Noto Sans JP`, `Noto Serif CJK JP`, `Yu Mincho`, `Hiragino Mincho ProN`, `Georgia`, `Arial` を作品固有書体の代用として追加しないでください。既存CSSに残る宣言は専用typography stylesheetを最後に読み込んで無効化し、回帰チェックでは禁止スタックの追加と専用stylesheetの読み込み順を検証します。外部書体が取得できない場合も、ゲーム固有のfallback familyから汎用generic familyへ落とし、禁止した旧指定へ戻しません。

## 操作説明の集約

3ゲームの通常プレイ画面では、操作そのものを説明できる内容を常時表示の文章として散在させません。原則として操作の意味は、各アプリの世界観に沿った短い動詞中心のボタン名、必要な `aria-label` / `title`、およびフォーカス・押下・長押しなど利用者がその操作へ関心を向けた時だけ開く短い補助説明へ集約します。

常時表示を残すのは、現在状態、物語上の情報、取り消し不能または高リスク操作の警告、操作対象を識別するために不可欠な情報に限定します。単なる「このボタンを押すと〜できます」「〜するには〜してください」のような説明は、ボタン自体の語彙と必要時だけ出る補助表示で理解できる形へ畳み込みます。説明を減らすために意味を曖昧な記号や汎用 `?` ボタンへ退避させず、初見でも行為が読めるラベルを優先します。

この原則は共通の無機質なヘルプUIを3ゲームへ導入するものではありません。`rinne` / `village` / `demon` はそれぞれ既存のHUD・パネル・演出語彙の中で説明を集約し、タッチ端末では hover 前提にせず、押下対象の最小サイズとキーボード/スクリーンリーダー向けの意味を維持します。

## クロスプレイ

全Platform共通のbackend player IDを使用し、各ストアのaccount IDは認証層でリンクします。クライアント申告だけで所有権や認証を確定しません。server authoritativeな状態と検証を用意し、gameId、protocolVersion、contentVersion、region、必要に応じinputPoolをmatchmakingに渡す設計です。version非互換なクライアントを同じsessionへ参加させない判定はserver側で行います。

network packageはendpointとPlatform HTTPを注入する入口です。リアルタイムtransport、matchmaking、招待、フレンド、Platformごとのクロスプレイ制約はまだ実装していません。transportを変更してもゲームルール内へSDKを持ち込みません。

## クロスセーブ

保存EnvelopeはschemaVersion / gameId / playerId / revision / updatedAt / payload。ゲームをまたいで同じセーブスロットを無条件に共有しません。村の共有状態が必要な場合はworld IDを持つ別のサーバー上のデータとして扱います。

Webのdevice-local storageキーはenvironment・gameId・playerIdを含みます。クラウド保存は別のCloudSavePortです。将来のserverでは認証したplayer IDとgameIdで権限を確認し、expectedRevisionによる競合検出、atomic書き込み、schema移行、offline再接続時の解決方針を実装します。client時刻のlast-write-winsだけで上書きしません。アカウント連携・引き継ぎUI・server・競合解決は今回の範囲外です。

## グローバル配信

テキストは今後locale keyで管理し、localeはPlatformから注入します。時刻保存はUTC epoch、world単位はmetres、座標系は右手系Y-upで固定します。リージョン候補・言語候補はgame-dataにあり、backend endpointをゲームルールへハードコードしません。CDN / regional service / regional save residency / storefront availabilityの具体設定はbackend・Platform選定時に確定します。

Webの現行DEVはGitHub Pagesの公開配信です。3アプリそれぞれのdistが独立しているため、後から別CDNや配信経路へ移せます。現在グローバル対戦やクラウド保存が稼働しているという意味ではありません。
