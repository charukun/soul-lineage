# Visual Review Navigation

Visual Review Lab の専門画面は、ページごとの独自実装ではなく同じ戻る操作を使う。

## 受入条件

- ランチャー (`review.html` / 公開ルート `/`) から遷移する各専門画面に、同じ見た目・同じ位置の「戻る」操作を1つだけ表示する。
- 対象はキャラ確認/モーション確認 (`characters.html`)、詳細調整 (`characters-advanced.html`)、装備・物体 (`review-assets.html`)、エフェクト (`review-effects.html`)、実戦 (`review-battle.html`) とする。
- 同一オリジンの直前画面から遷移してきた場合はブラウザ履歴を1つ戻し、実際の前画面へ復帰する。
- 直アクセス、外部サイトからの遷移、または安全に履歴へ戻れない場合は Visual Review の公開入口 `/` へフォールバックする。
- 各ページに個別の「ゲームへ戻る」「Reviewへ戻る」「確認画面へ」実装を残さず、共通部品を正本とする。
- モバイルでは safe-area を避け、44px 以上のタップ領域を確保する。
- Visual Review ランチャー自身には戻る部品を表示しない。
