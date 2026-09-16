# 3アプリ独立 browser baseline

最新developのアプリ本体を修正する前に、輪廻転焦・MURAAAAAAA・尽喰廻遊をそれぞれ独立した mobile Chromium 実操作で確認する。

## 目的

- 1アプリのbrowser scenario失敗で他アプリの観測を止めない。
- 390x844を基準に、開始、移動、主要操作、補助UI、戻る/閉じるの実操作証拠を残す。
- pre-fix のスクリーンショット・trace・操作結果からUI改善計画を作る。
- この診断PRはアプリ本体を変更せず、得た所見は実装PR #612へ引き継ぐ。

## 実施順

同じdocs-only headを基礎に `Browser-Playtest:` 対象を1アプリずつ切り替え、各回を独立させる。完了後、この診断PRはmergeせずcloseする。

main / Productionは変更しない。
