# 採用アセットと出典

## GitHubから新規取得し、実際に使用したもの

採用元は Kay Lousberg / `KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0` です。

固定commit: `b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07`

| ファイル | Git blob | 使い方 |
|---|---|---|
| `addons/kaykit_dungeon_remastered/Assets/obj/floor_tile_small.obj` | `2d4ed18e2d4ad6bb8213618e6b5f283cc4effe4b` | 生成村の石畳。通常117インスタンス |
| `addons/kaykit_dungeon_remastered/Assets/obj/banner_blue.obj` | `1306d527258a549e6b202d00aaf7f8680c30248f` | 村門と礼拝所の布。通常4インスタンス |

ライセンスは元Repositoryの `LICENSE.txt` で確認した CC0 です。作者表記とライセンス本文を `licenses/KAYKIT_LICENSE.txt` に収録しています。取得はGitHub接続のファイル読み取りを使用しました。

保持したのは頂点と面の構成です。夜景用に再着色し、元のUV・法線・外部アトラス参照を外して法線を再計算しています。したがって同梱OBJのSHA-256を元のGit blobと同一とは表示しません。加工後ファイルのハッシュ・出典・変換内容は `assets/kaykit/manifest.json` に記録しました。変換された2種は、単体HTMLにも埋め込まれています。

新規取得して実装へ採用したのはこの2種類です。候補として確認した壁や松明のファイルを、採用済みの数には含めません。

## 既存プロジェクトの再利用

家屋・生活小物は、ユーザーのLibraryの `Hoshitsugi_Village_Package.zip` 内にある `src/web/models.js` と `src/game/catalog.js` を再利用しました。`packages/housing/` にコピーし、import先を調整しています。描画時に夜景用の材質を適用しています。この部分を新しくGitHubから取得したモデルとは数えません。

怪物、人間、木、墓石、襲撃用の門・細部は手続き型の試作モデルです。人間と怪物の高品質な外部GLBモデルは今回取得・採用できていません。音はWeb Audioによる合成音です。アニメーションとVFXの表示は、この試作のモデルとエフェクトを共通戦闘の結果・ポーズに結び付けています。

描画ライブラリは既存パッケージに含まれた Three.js を再利用しています。MITライセンス本文は `licenses/THREE_NOTICES.txt` です。アバターVRMの独自ライセンスがこの人間捕食用途を許可すると推定せず、それらのモデルはこの版へ転用していません。

## 参照元

- https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0
- https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/blob/b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07/LICENSE.txt

このファイル中のURLは出典を確認するための記録です。ゲームの実行時に読み込むURLではありません。
