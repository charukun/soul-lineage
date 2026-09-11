# Lanternfell素材活用: 第一段階の実装

**状態: 素材接続の第一段階。実素材取得・ハッシュ検証・ローカルビルド確認済み。ブラウザ検証と公開は別gateで記録します。**

対象はVisual Review Lab。PR #23をDraftに保ち、main / develop / 既存DEV / Productionのrefや公開先を変更しません。基準developは802cd25b2b7ec3c100f1655f3c58a2ef239f2f9bです。適用時は最新developのタイトル・参加機能を保ったまま、Lab差分を重ねる必要があります。引き継ぎ元のLab headは0aa03634eec1d887d74e255cc88792f5ba5f5e75です。素材選定は `Lanternfell_3Games_Asset_Review.md` のShino維持・既成動作の適用・Kenney VFX・KayKit装備の限定採用に従います。

## 追加内容

- 既存ゲームと同じSHINO_review.vrmを読み込み、SHA-256を照合。棒人間や自作動作へのフォールバックはありません。
- Quaternius AnimationLibraryの固定版をビルド時に取得。配布元の動作名を保持し、6系統の未収録欄は「未収録」のまま表示。
- @soul/rendering/quaternius-retargetは生のVRM1骨へ変換する共有モジュール。元のTポーズと階層間の回転差を使用し、元データを改変しません。PR #26のraw-bone poolへ渡せるUUIDトラック形式です。ただし今回のLabは単体表示で、PR #26全体は取り込んでいません。
- KayKitの大剣は外部制作の形状・画像を使用。倍率0.5で仮取付し、姿勢と両手の握りは承認前。
- Kenneyの火花・光・粉塵は共有描画モジュールで再生。確認用マーカーは本体の命中イベントと明確に区別します。
- 再試行、静止比較、低速再生、停止中のコマ送り、時刻指定、骨格表示、素材版とコミット表示、状態URLを維持。

## 取得と検証

3DデータのBase64転送や分割pushは行いません。Shinoは既存Git実体を使い、追加素材は固定commitからGitHub Actionsが取得します。取得後にサイズ・既知Git blob hash・GLB構造を照合する処理を実装し、全ファイルのSHA-256をmanifestへ記録します。ライセンスと出典も配信成果物に含めます。失敗した取得物を成功扱いせず、buildを停止します。

`npm run build:review`で局所単体テスト、workspace境界検査、実素材取得、Rinne build、Workersの容量検証を実行します。`npm run test:review-browser` は対象LabのみのChromium/WebGLスモークテストです。専用workflowでは公開前と公開後に実行し、公開後はJSと素材manifestのcommitを当該GITHUB_SHAと照合します。ソフトウェア描画による390×844と1280×800の確認であり、Pixel Fold実機性能や見た目の承認を代替しません。証跡は `artifacts/review-local/` と `artifacts/review-public/` へ出力し、Actions artifactに14日保存します。静的配信物へテスト証跡を混在させません。

公開は既存のVisual Review Preview workflowだけを使用します。REVIEW_PREVIEW_ENABLEDやCloudflare認証をこの変更で勝手に有効化しません。build成功とWorker公開成功を区別してください。

## 未完了・採用前の確認

足IK、足滑りの見た目、武器の両手握り・構え、本体の命中イベント/効果音/ヒットストップへの接続、世代・体格差/30体表示の適合は未承認です。MURAAAAAAAの家具と護衛、魔物側の敵・背景の導入は次段階で、今回の変更には含めません。

Depends-On: none (first-stage single-actor preview only). Visual approval is pending; keep PR #23 Draft.

## 今回の実素材照合

追加11ファイル、合計6,888,973 bytes。待機3・歩行2・走行2・剣攻撃2・被弾2・死亡1の対象クリップを固定GLB内で確認。他の収録動作も配布名のまま選択できます。Shinoは既存18,541,124 bytesの実体をSHA-256照合し、そのまま参照します。

ブラウザや端末から未確認の見た目を合格とは扱いません。足IK・両手握り・実機負荷は引き続き採用前の確認事項です。
