# 尽喰廻遊 外部モンスター Evidence

## 目的

外部CC0モデルを採用した怪物種について、説明画像や生成画像ではなく、実際の尽喰廻遊WebGLランタイムが取得・検証・描画した画面をEvidenceとして保存する。

## 今回のキャプチャ

- 対象は現在の `develop` に統合済みのGobkit由来5種と既存 `night-creature`。
- `Browser-Playtest: demon` の実Chromium経路を使い、タイトルから `狩夜へ` を実入力してランダム村へ直接入る。
- EvidenceはPlaywrightのscreenshot / trace / console-network診断を正本とし、外部GLBが成功した場合はcanvasの `data-monster-species` と `data-monster-model` も同時に記録する。
- 外部GLB取得、Git blob SHA検証、parseのいずれかに失敗した場合は `gobkit` 表示成功として扱わず、`fallback` をEvidenceへ残す。
- 生成画像、Gobkit配布ページのプレビュー、手続き型fallbackだけの画像を外部モデル実装成功の証拠として扱わない。

## 判定境界

この診断PRはゲーム仕様を変更しない。現在のランダム入村、捕食成長、種別抽選、戦闘判定をそのまま使う。ブラウザ経路が現仕様と不一致で途中失敗した場合も、その失敗を隠さずtraceとreceiptを保持する。
