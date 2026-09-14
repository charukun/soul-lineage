# モーション制作・比較の実行手順

モーションを変更するWORKは、既存の [Motion QA](MOTION_QUALITY.md) と本手順を読む。
目的は、全身の演技を先に設計し、等速での見え方を根拠に採用すること。
関節・接触の数値検査、ビルド成功、反復回数は、迫力や自然さの合格判定ではない。
本手順は既存QAレポートの拡張であり、新しいWorker・キュー・承認サービスは作らない。

## 1. 対象と基準を固定する

- 最新developと対象branch、PR・所有記録・前回比較を取得する。未完了バッチは続きから再開する。
- 実ゲームの既存技ID、共有ソース、モデル／リグ、revisionを追跡する。別モデルや鑑賞専用の技で代用しない。
- 参照素材の場所と実際に見た秒数を記録する。元動画 `1000003098.mp4` が無い場合は、Labの
  `apps/rinne/public/simulator/assets/review/reference-sword-4s.mp4`（元動画2.5–6.5秒）を使い、範囲外を未確認とする。
- 改善前の実モデルを保存し、入力・技の長さ・攻撃判定時刻・ダメージ・移動ルールを不変条件として記録する。
- その技で何を感じさせるかを一文で決め、参照との差を優先度順に三つ以内へ絞る。

## 2. 主要ポーズを先に作る（blocking）

構え → 溜め → 打点 → 振り抜き → 次へ渡す姿勢を、既存技のキーポーズとして設計する。
各ポーズに技内時刻、支持脚、重心の位置／進行方向、骨盤と胸の向き、剣の軌道を記す。
正面と側面以上で実モデルを描画し、全身のシルエットと支持脚に乗った姿勢が読めるか比較する。
構え・移動では、接地 → 蹴り出し → 遊脚 → 着地／制動など、実際の状態に対応する主要点を選ぶ。
まだ弱い場合はここへ戻る。手首・指・髪の細部を先に磨いて完了扱いにしない。

## 3. 重心と緩急を作り、等速で評価する（primary）

足の接地・蹴り出し・制動から骨盤 → 胸 → 肩 → 腕へ力が伝わる時間差を設計する。
移動量と速度カーブを見て、溜めと振り抜きの差、重心の高低差・左右移動・回転を作る。
全関節へ同じイージングをかけて均すことを完成条件にしない。既存の打点時刻を動かして迫力を作らない。

修正前・修正後・参照を**1倍速の連続再生**で確認し、次を文章で判定する。

- 構えから次の動きの意図が読めるか。
- 足で身体を運び、重さを受け止めているか。
- 溜め／打点／振り抜きに明確な速度差があるか。
- 上下半身が連動し、技の終わりから次へ勢いを渡せるか。

1/2・1/4速とコマ送りは原因調査に使う。静止画、コマ一覧、MP4を書き出しただけの状態を
「等速で視聴済み」と記録しない。視聴できなければ未確認として次工程を残す。

## 4. 細部と接続を磨く（polish）

肩・肘・手首・武器保持、足滑り、身体／服／髪の干渉を確認する。修正後は再度等速で見る。
単体 → 既存技の短い組み合わせ → 30秒演武、および構え → 移動 → 制動 → 攻撃の接続を確認する。
固定した同条件の比較を主とし、カメラ追従・揺れ・エフェクトは身体の弱さを隠す手段にしない。
無関係な全アプリ巡回を毎修正に要求せず、影響した技と接続を確認する。

## 証拠・採用・復旧

既存 `character-motion-qa` レポートとLabの `SWORD_REFERENCE_ITERATIONS.md` /
`sword-reference-iterations.json` を使い、新しい独自台帳を増やさない。
各修正に参照秒数、差、狙い、変更前後のSHA／復元可能な差分、実描画証拠、比較結果、残る差を残す。
主要ポーズ、等速比較、細部の順に判定を残し、前工程が要修正なら後工程だけで採用しない。
悪化・差が判断不能の変更は採用せず、戻した理由と比較を保存する。
100回はユーザー指定の実作業回数であり、品質点数ではない。未完了は実数と次の工程を残す。

証拠には共有ソースrevision、モデル／リグ、視点、再生速度、参照／出力動画内の秒数を付ける。
CPU実メッシュ描画は使用可。ただし簡易照明、WebGL未検証、端末fps未検証を区別する。
記録検証器が確認できるのは項目と順序であり、視聴の真偽や芸術的品質を自動判定できるとは言わない。
作業者の比較判定と人間の最終見た目承認を分け、未承認を自動承認へ変えない。

## 配布と責任範囲

### 既存JSONへの記録方法

Character WorkshopのMotion QAで新規作成したレポートのJSON出力には、空の `authoring` が入る。
作業者が実際の比較後に記入し、既存のJSON読込／出力で検証する。専用入力画面や自動視聴機能は追加しない。
旧v1レポートには `createAuthoringReview()` の結果を追加できる。欠落した旧記録は未評価として保持する。

```js
import { createAuthoringReview, authoringProgress, serializeQAReport } from '@soul/animations';
report.authoring ??= createAuthoringReview();
// 実際の比較を記録した後に、既存JSON出力と同じvalidatorを使う。
console.log(authoringProgress(report.authoring));
const json = serializeQAReport(report);
```

- `source`: 変更前後のrevision、実model／rig、既存motion ID、不変条件。
  `after` は `report.review.motionRevision` と一致させる。SHAやソース差分の場所は証拠と既存反復記録に残す。
- `reference`: 実際に参照したasset、動画内 `range: [開始秒, 終了秒]`、分かる場合は元動画の `originalRange`。
- `keyPoses`: `label` / `time` / `support` / `centerOfMass` / `silhouette`。技内の主要点を最低3点記録する。
- `stages.blocking / primary / polish`: `status` は pending / revise / reviewed、
  `outcome` は unverified / improved / unchanged / regressed。`observation` にその工程の比較結果を記す。
- `evidence[]`: `kind` (image/video)、`role` (before/after/reference)、`uri`、`revision`、
  `camera`、`range`、`renderer` (webgl/cpu-mesh/reference)、`reviewed`、動画なら `speed`。
  画像のrangeは該当連続コマの区間。blockingはfrontとleftまたはrightの実モデル画像を使う。
  revisionはbefore/afterのsource値、参照はreference.assetと一致させる。
- `remaining` / `limitations`: 残る差と検証限界。CPU利用時は照明・WebGL・実機fpsの未検証を具体的に残す。

`reviewed` は作業者が証拠を確認した申告であり、人間の最終承認ではない。
記録上の全工程完了でも `authoringProgress().visualApproval` は `not-assessed` のまま。
未観測を空の成功値で埋めずpending/reviseで保存する。前工程が崩れたら後工程もpendingへ戻す。

### 通常Integrationへの接続

Lab専用 `work/visual-review-lab-v2` / PR #23 はDraftと独立公開を維持する。
三作取り込みは検証済みの共有差分と必要な接続だけを別PRへ移し、各アプリの実呼び出しと配布を確認する。
対応しないモンスター等のリグへ人型の剣動作を強制しない。
通常WORKはReady → `READY_FOR_INTEGRATION` まで。既存のreview・hold・CI条件を守り、
Integrationがdevelop統合とDEV公開を担当する。Lab PRのmergeや人間の最高品質承認を通常取り込み条件へ追加しない。

## 公開情報から取り入れた考え方

[Coloso・Lee講座](https://coloso.jp/products/3dcreator-lee-jp) の公開カリキュラムを2026-09-14に確認。
動作分析・キーポーズ・タイミング／スペーシング、全方向で読める待機姿勢、
blocking → primary → polishの考え方を、上記の既存ランタイム向け手順へ具体化した。
講義本編や配布リグを取得・利用したものではない。Maya／Unity移行や有料API導入を前提にしない。
ゲーム仕様・Repositoryポリシー・実際の参照素材を優先する。
