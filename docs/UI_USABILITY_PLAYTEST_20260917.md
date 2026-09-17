# 3アプリ UI操作性 再playtest 2026-09-17

輪廻転焦 (`rinne`)、MURAAAAAAA (`village`)、尽喰廻遊 (`demon`) を、最新 `develop` を正本としてスマートフォン相当の実Chromium入力で再確認する。

## 受入条件

- 修正前の3アプリをそれぞれ独立した mobile Chromium で実操作し、1アプリのscenario失敗で他アプリの観測を止めない。
- 修正PRでは `Browser-Playtest: all` で3アプリすべてを実ブラウザ入力し、run / artifact / `playtest-receipt.json` を残す。
- タイトル開始、主要移動、主要ゲーム内操作、主要メニュー、戻る/閉じる操作を確認する。
- 実プレイ証拠から、誤タップ、指で隠れる操作、常時読む必要があるUI、重複した案内、閉じにくいモーダル/ドロワー、低FPSで待ち時間が伸びる操作を優先して扱う。
- 類似open PRと直近merged PRを確認し、重複実装を作らない。
- 必要なuser-facing修正後に `Browser-Playtest: all` を再実行する。
- develop統合後にDEV公開/source確認まで行い、main / Productionは変更しない。

## 修正前 browser evidence

### 輪廻転焦

- 独立診断PR #634で 390x844 Chromium / WebGL2 のタイトル → `新しい人生` → 出生期本編まで実起動した。
- 出生期では `母と村巡り`、`スワイプで母を動かせる`、抱っこ状態を確認した。
- 旧browser scenarioが廃止済みwaypoint chromeを要求して停止したため、productへwaypointを戻さず、現行HUD契約へscenarioを追従する。
- 診断後にmerged #625がプレイHUDの素材感、下部操作、意識/所持品/地図、DEBUGの視覚階層を刷新している。今回それを重複実装せず、最新developを採用する。
- 現行guidanceは4歳直後に住居・かかし・暮らしへ導くため、旧固定値 `武具 7歳` をbrowser contractにしない。出生解除、次の短い目的表示、後続の8歳武具選択を別々に検証する。

### MURAAAAAAA

- 独立診断PR #631で 390x844 Chromium / WebGL2 を起動し、first-run guideの開始、つくる、空きテント選択、ドラッグ、配置、完了まで実タッチ入力した。
- richer first-run guide完了直後に旧legacy tutorial CTA `1 / 5 空きテントをひとつ` が再表示され、同じ導入を続けて要求する重複を確認した。
- 改善はfirst-run guideを完了または明示skipした時点でlegacy tutorialをdismissedとして保存し、同じ案内を二度出さないこと。

### 尽喰廻遊

- 独立診断PR #633で 390x844 Chromium / WebGL2 のタイトルから `狩夜へ` を実クリックし、生成済み狩場へ直接入り、移動可能なHUDと自動戦闘が進行するところまで確認した。
- 現行productには旧 `[data-village]` 選択画面がなく、browser scenarioだけがそれを30秒待って停止していた。
- product UIを戻さず、`狩夜へ` → HUD直行をbrowser contractにする。既存のpause、動きかた、音楽、閉じる操作の実タッチ検証をそのまま通す。
- movement-only HUDは常設説明・嗅覚・ダッシュ停止等を隠し、pauseを低頻度ヘルプ入口にしている。修正前 evidence では新たなuser-facing追加UIを必要とする問題は確認しなかったため、この簡潔さを維持する。

## 重複確認と改善計画

- 同目的の旧PR #488は現在developから大きく乖離した未完了作業だったため、#612へ引き継いでclose済み。
- open PR検索で、Village first-run二重tutorial、Demon direct-entry browser contract、RINNEの今回のbrowser追従と重なる実装PRは確認できなかった。
- RINNEのHUD立体化はmerged #625と重なるため新規実装しない。
- 実装対象は次の3点に限定する。
  1. Village: richer first-run完了後にlegacy tutorialを再表示しない。
  2. Demon: browser playtestを現行の `狩夜へ` 直行フローへ追従し、既存pause/help/music/close操作を実際に通す。
  3. RINNE: browser playthroughを現在のwaypoint-free・段階的guidanceへ追従し、productの新しい導線を旧assertionで巻き戻さない。

## 記録ルール

`static review`、`browser playtest`、`DEV browser verified` を区別する。修正後の3アプリが `completedApps` に揃うまでは「修正後3アプリ完走」と記録しない。
