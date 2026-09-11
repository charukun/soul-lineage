# @soul/audio

3ゲーム共通の音声素材と定義を保持します。ゲーム進行やPlatform SDKへの依存は置きません。

## 三界の調べ / 150

正式配置先: `packages/audio/assets/bgm-150/`。

- `audio/<id>.ogg`: 元ZIPとバイト一致する150曲。輪廻48曲・村48曲・魔物48曲・共通6曲。
- `ogg-manifest.json`: 実在するOGGのID・相対パス・サイズ・SHA-256・利用状態。各パスはこのmanifestを基準とします。
- `catalog.json`: 元ZIPのカタログをそのまま保持。MP3/FLAC/MIDI参照やそれらのハッシュは元パッケージの記録であり、この配置のOGG参照には使いません。
- `source-files.json`: 元ZIP内156ファイルのサイズとSHA-256。
- `docs/`・`tests/ogg-all150.json`: 元ZIPの権利表記と既存の検査記録。今回再実施した検査とは区別します。

パッケージ公開パスは `@soul/audio/bgm-150/manifest.json` と `@soul/audio/bgm-150/*`。
利用するappは既存ルールに従い `@soul/audio` へのworkspace依存を宣言してください。

今回の反映は素材の配置と参照口の追加です。ゲーム再生・試聴UI・DEV配信との接続は別作業です。
`src/index.js` の既存公開APIは維持しています。

元の `productionStatus=audition`、`commercialClearance=false`、`licenseStatus=review-required` を保持しています。

## 取込検証

Codespaces上で元ZIPのサイズ（176,401,417 bytes）、SHA-256、全エントリのCRCを検証し、
配置した156ファイルと元ZIPのバイト一致、150曲のID一意性と全OGGとの対応、OGGヘッダーを確認しました。
音源の再エンコードや新たな聴感評価は行っていません。
