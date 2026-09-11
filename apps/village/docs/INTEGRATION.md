# Village Life & Guard integration

## 正本と範囲

Base: `charukun/soul-lineage` develop `69ea1f714e6c07bea079884ab7ebc0088f0feaa9`。
入力: `Hoshitsugi_Village_LifeAndGuard_Package.zip`。既存の `apps/village` の入口・Vite構成・共通Platform契約を維持します。`apps/rinne`、`apps/demon`、main、Production、CI/CD定義は変更対象外です。

`src/game/{core,catalog,terrain,simulation,bridge}.js` は添付のゲームルールを変更せず移設しました。512m四方、村長と護衛の初期生活、建築・内装・取り消し、地形・資源解放・建材選択、住民の生産・食事・家具・移住、人口制限、11m護衛保護、救助、45秒予告と人口連動のAI襲撃、増築、5年ごとの船を保持しています。

## 統合上の変更

ブラウザからCDNや添付vendorへ依存せず、`@soul/rendering` にエンジンnamespaceと `mergeGeometries` の追加exportだけを設けます。既存の `createWorldPreview` は変更しません。依存・lockfile・他ゲームのソースは維持します。この共有packageの影響は既存のaffected判定に任せます。

既存の共通world templateは変更しません。そのfoundation benchを実体のある景観として描画し、既存のcanvas起動診断（app/commit/environment/world/asset/platform）を保持します。新しい生活worldの識別は `data-game-world=hoshitsugi.life-and-guard.v5`。`renderer=ready` は最初の実描画後だけ設定します。読込失敗・初期化失敗・context lossは失敗表示と再試行へ進み、WebGL失敗を成功扱いするfallbackはありません。

## 保存

Platform storageと共通SaveEnvelopeを使用し、environment / gameId=village / playerId=local を分離します。スロットは `living-v5`。保存はスナップショット時点で直列化し、非同期の古い書込が新しい保存を追い越さないようにします。起動時に不正・他ゲーム・互換性のない保存を検出した場合、新規村で黙って上書きしません。

利用者が確認した場合だけ、元データを別の回復キーへ書き込んでから有効スロットを除去します。退避失敗時は原本を削除しません。元のv4/v5 JSONは既存のファイル読込UIで明示的に移行できます。環境識別のない旧 `rinne-village-living-v5` をDEVやProductionへ自動で混入させません。保存失敗中もJSON書き出しを利用できます。

現在のローカル保存にはサーバー側競合解決・クラウド同期・複数タブ間の排他はありません。別タブで同じ村を同時編集しないでください。

## 未接続の機能を成功扱いしない

本編の実プレイヤー、魔物プレイヤー、共通オンライン村、認証、村長ホスト/Host Migration、本編の戦闘・時計・乗船転送は今回のdevelopに接続先がないため、このローカル村とは未接続です。一族居住はデータ契約と明示的なデモまで、襲撃はAIです。UIでもその区別を表示します。新しい共有ネットワーク契約を勝手に制定しません。

時計は添付のローカル仕様（1日60秒・1年12日、停止/1/5/20倍）を維持し、非表示タブでは進行を止めます。SwiftShaderによる画面確認はPixel Fold実機の性能保証やコンソール対応の証明ではありません。

## 検証と引き渡し

- 元のゲームルール64件に保存保護・環境分離9件を追加し、Nodeで73件成功。
- 3600秒の決定的進行テスト成功。19人、4襲撃、喪失0人、増築10件、生産・食事・家具購入を確認。
- ローカルUIの57項目、起動・保存・context lossの異常系7項目が成功。ローカルUI確認はネットワークの管理制限によりabout:blankで統合ソースをdata URLとしてロード。添付Three.js 0.185.1とメモリ保存ポートを利用する限定試験であり、配信URL・本番保存・Repository pin 0.186.0による動作証明とは区別します。
- 正式なNode 24 / lockfile / Three.js 0.186.0 / Viteビルドは未実行。GitHubへのソース登録がOpenAIの安全性確認でブロックされたためcommit/PR/CIには未到達です。次の担当は既存高速CIで確認し、実行結果をPRに記録してください。
- 最終develop・DEV公開・公開URLの実Chromium確認はIntegration担当。Readyや高速CIだけで公開完了と報告しません。

Depends-On: none
