# モーション Visual Review 入口

RINNE のモーション確認は、独立した `apps/review` の Visual Review Lab にある「モーション」導線を正本とする。
その導線は RINNE の `apps/rinne/review-motion.html` を開く。削除済みの `characters.html` / 旧キャラクター工房を復活させない。

## 役割

- 登録されたsource motionを分類・選択して1本ずつ再生する。
- モデル切替、再生/一時停止、最初から、速度、ループ、タイムライン、1フレーム前後、カメラ切替を同じ画面で行う。
- source repository / revision / path / upstream clip name/index / author / license / immutable hashを確認できる。
- Visual Review Labへの戻り導線を維持する。

## source motion 契約

- 同じ元clipのモデル差、retarget、速度、mirror、trim、loop、root motion、形式変換、blend/additive/IK差を重複計上しない。
- `MOTION CLIPS` は異なるsource identityから動的に算出し、モデル数を掛けない。
- 「すべて」ではregistry内の実source motionを全件選択できる。
- manifestや全animation binaryを起動時に一括取得せず、外部sourceは選択時に遅延取得する。
- ライセンス不明、出典不明、世界観外として除外したclipを登録済み件数へ加算しない。

## 高速DEV境界

- `predev` / `prebuild` で外部motion全件取得・変換・全model走査をしない。
- `Astra Work Validation` にPlaywright/Chromium、全model × 全motion matrix、全payload evidence生成を追加しない。
- focused validationはsource identity、provenance、重複規則、分類、動的件数、unsafe pathなどの軽量で決定論的な契約とaffected buildに限定する。
