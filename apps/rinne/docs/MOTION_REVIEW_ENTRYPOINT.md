# 演舞レビュー入口

RINNE のキャラクターモーション確認は、`apps/rinne/characters.html` の「演舞レビュー」を正本とする。

## 役割

- 正本の「モーション一覧・30秒演舞」から、既存の `review-motion.html` を工房内のビューアとして開く。
- 同じビューアでモーション選択、再生・一時停止、最初から、速度、反復、タイムライン、コマ送り、カメラ、KayKitモデル切替を行う。
- 30秒演舞の主導線は正本ページ内だけに置く。既存の補助URLは維持し、正本へ戻る導線を持つ。
- 旧 `apps/rinne/public/simulator/motion-review.html` は互換URLとして正本へ案内し、新しい確認機能を追加しない。
- 工房の既存Motion QA記録・補正比較UI・JSON形式は削除しない。条件付き旧モデルの停止中QA sourceは復活させず、新しいCC0実素材の再生と区別する。
- 本編保存、ゲーム状態、既存Motion QAデータ形式には影響しない。

## 実ソース台帳

`src/review-motion-sources.js` が取得元を固定し、`scripts/prepare-rinne-motion-library.mjs` が実GLBを検査して `public/simulator/assets/motion-library/catalog.json` を生成する。RINNEのpredev/prebuildで実行される。バイナリは既存のKayKit準備処理と同じく、固定revisionとGit blob SHAを検証して配置する。

各登録モーションは repository / revision / path / upstream clip name / index / Git blob SHA / SHA256 / clip fingerprint / author / license を持つ。source identityの生成・重複排除は `review-motion-identity.js`、分類は `review-motion-catalog.js`、画面と件数検証は `review-motion-manifest.js` に置く。

速度、左右反転、部分クリップ、ループ、Root Motion、別形式、モデル別埋め込み、retargetは別モーションと数えない。同一作者の既知の改名・反復・切り出しは明示的なfamily aliasでまとめ、チャンネルfingerprintの完全一致も除外する。曖昧な派生は保守的に同一種類へまとめる。

`MOTION CLIPS` は登録されたcanonical source identityのunique件数から動的に表示する。「すべて」は全登録モーションを選択できる。元の埋め込みクリップは派生・静止姿勢を含めて別の折りたたみ選択に保持し、件数に重複加算しない。30秒演舞はおすすめの実クリップを順に再生するプレイリストであり、新しいモーションとして数えない。

## 再生と検査

- 初期表示は軽いmanifestと選択中のモデルのみ。追加GLBは選択時にsource単位で遅延取得し、再選択・モデル切替ではキャッシュを使う。
- KayKit Rig_Mediumは同名骨格を直接利用する。Quaterniusは既存の `normalizeHumanoidPose` / `retargetHumanoidPose` とrenderingのrest-frame処理を使い、元のZ-upルート座標や中間骨をアダプタで扱う。対象モデルの骨長・scaleは変えない。
- 30fpsの実クリップサンプリングを全KayKitモデルで行い、非有限値、異常移動、床抜け、過大な補正を検査する。新規の不適合モーションは登録せず、理由をevidenceに残す。
- 変更されたNodeテスト、DEV checks/buildに加え、モーション差分のfinal-head validationでは既存Playwright/Chromium経路で全件選択・再生、モデル切替、操作、工房導線、モバイル表示を検査する。
- `artifacts/motion-source-qa/source-motion-evidence.json` に集計、全alias、除外、全モデルの骨格検査を出力する。`artifacts/motion-browser/` に選択receipt、画像、traceを出力する。最終headのActions artifactを検証証拠とする。
- 自動検査は人のVisual Approvalを捏造しない。既存キャラクターのproduction stageやProduction gateは変更しない。

出典・利用条件は `public/simulator/licenses/MOTION_LIBRARY_SOURCES.txt` を参照。
