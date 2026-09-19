# NOCTURNE / 灰の誓約

Three.js 0.180.0 / WebGL2 の自動戦闘ゲーム。既存の本番ゲームとは独立したアプリです。

## 操作

「森へ踏み入る」で開始。索敵・移動・攻撃・必殺技は自動で行います。猛攻、均衡、堅守の構えを切り替えられます。地面をタップすると一時的に移動先を指定します。各襲撃の間に強化を選択し、5段階目のボスを倒すとクリアです。強化は6秒後に自動選択されます。

右上で一時停止、音声、画質を切り替えられます。音声は初期状態でOFFです。速度は1倍と2倍。スマートフォンでは標準画質を使用します。

## 3Dモデルについて

AIによる3Dモデル生成は行っていません。地面も含め、シーン内のすべてのメッシュは配布元のGLBを読み込み、複製またはインスタンス化したものです。配置・縮尺・材質・ライティングを調整しています。斬撃・火花・炎・体力表示などは別の2Dキャンバスで描画します。ゲーム用の新しい頂点形状は作成していません。

- Kay Lousberg / KayKit Adventurers: CC0 1.0、取得リビジョン固定。
- Kay Lousberg / KayKit Skeletons: CC0 1.0、取得リビジョン固定。
- Kenney / Nature Kit: CC0 1.0。
- Three.js: MIT。

`prepare.py` は配布元のライセンス文を保存し、全GLBのSHA-256を記録します。`build.mjs` はモデルが取得時から変更されていないことを照合します。`assets-manifest.json` で配布元・ライセンス・ハッシュを確認できます。338種類の外部モデルを監査し、ゲームの読み込み対象は28種類です。

## ローカル実行

このディレクトリで実行してください。Node.js 22以降、Python 3、外部通信が必要です。

```sh
npm install --workspaces=false
npm run build
python3 -m http.server 4173 --directory public
```

## 検証

```sh
npx playwright install --with-deps chromium
node smoke.mjs http://127.0.0.1:4173
```

Chromiumで実際にページを開き、WebGL2、外部アセット読み込み、自動戦闘、一時停止・再開、構え、速度、音声ボタンを検証します。デスクトップ1280x800、モバイル412x915を検証し、画面を保存します。全5段階のクリアは同じブラウザ内のシミュレーションを固定時間刻みで進める追加テストで確認します。

CIのソフトウェア描画とモバイル画面エミュレーションは、実機スマートフォンの性能試験ではありません。添付参考動画との完全な画質一致や実機FPSを保証するものではありません。

## 公開

`.github/workflows/nocturne-external-assets.yml` が専用ブランチの変更をビルド・検証します。テスト通過後、専用Cloudflare Worker `nocturne-autobattle` を公開し、公開URLのビルドSHAが対象コミットと一致することを確認してから、認証情報を持たない新しいブラウザで再検証します。

`public/build.json` は対象SHA、`public/qa/report.json` は公開前テスト、GitHub Actionsの成果物 `evidence/public/report.json` は公開URLでのテスト結果です。既存のmain/developおよび既存本番Workerは変更しません。
