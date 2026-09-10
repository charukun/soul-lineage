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

## クロスプレイ

全Platform共通のbackend player IDを使用し、各ストアのaccount IDは認証層でリンクします。クライアント申告だけで所有権や認証を確定しません。server authoritativeな状態と検証を用意し、gameId、protocolVersion、contentVersion、region、必要に応じinputPoolをmatchmakingに渡す設計です。version非互換なクライアントを同じsessionへ参加させない判定はserver側で行います。

network packageはendpointとPlatform HTTPを注入する入口です。リアルタイムtransport、matchmaking、招待、フレンド、Platformごとのクロスプレイ制約はまだ実装していません。transportを変更してもゲームルール内へSDKを持ち込みません。

## クロスセーブ

保存EnvelopeはschemaVersion / gameId / playerId / revision / updatedAt / payload。ゲームをまたいで同じセーブスロットを無条件に共有しません。村の共有状態が必要な場合はworld IDを持つ別のサーバー上のデータとして扱います。

Webのdevice-local storageキーはenvironment・gameId・playerIdを含みます。クラウド保存は別のCloudSavePortです。将来のserverでは認証したplayer IDとgameIdで権限を確認し、expectedRevisionによる競合検出、atomic書き込み、schema移行、offline再接続時の解決方針を実装します。client時刻のlast-write-winsだけで上書きしません。アカウント連携・引き継ぎUI・server・競合解決は今回の範囲外です。

## グローバル配信

テキストは今後locale keyで管理し、localeはPlatformから注入します。時刻保存はUTC epoch、world単位はmetres、座標系は右手系Y-upで固定します。リージョン候補・言語候補はgame-dataにあり、backend endpointをゲームルールへハードコードしません。CDN / regional service / regional save residency / storefront availabilityの具体設定はbackend・Platform選定時に確定します。

Webの現行DEVはGitHub Pagesの公開配信です。3アプリそれぞれのdistが独立しているため、後から別CDNや配信経路へ移せます。現在グローバル対戦やクラウド保存が稼働しているという意味ではありません。
