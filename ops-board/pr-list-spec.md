# PR list display contract

Rinne Ops Board のPR一覧は、GitHub標準状態をそのまま基準にする。

1. PR本文の先頭の空でない2行を title / detail として扱う。
2. 状態は Draft / Ready / Merged / Closed の4種のみを主表示する。
3. updated_at を必ず表示する。
4. Draftで一定時間更新がない場合のみ弱い警告表示を許容する。
5. Visual Review Lab系の長寿命Draftは通常タスク一覧とは別セクションへ分離する。
6. 一覧はPixel Foldを含む縦持ちスマホで高密度に表示する。
