# 出典単位のモーションライブラリ

## 入口

正本は独立 `apps/review` の Visual Review Lab にある「モーション」導線で、実体は `apps/rinne/review-motion.html`。
現developで削除済みの旧 `characters.html` / キャラクター工房を復活させない。

## 正本と件数

- `src/review-motion-sources.js` に外部sourceの repository / revision / path / clip name/index / author / license / immutable hash を固定する。
- `src/review-motion-registry.js` が source identity と variation collapse を決定する。
- 同じ元clipの速度、mirror、trim、loop、root motion、retarget、形式変換、モデル差は別モーションとして数えない。
- `MOTION CLIPS` はregistryのunique source identity数から動的に算出する。モデル数を掛けない。
- 現代の銃、電話、運転、ダンス、static poseなど世界観・用途外のclipは除外理由をregistryに残す。

## 再生

build時にモーション全件をコンパイルしない。起動時にも全source binaryを取らない。

`src/review-motion-source-runtime.js` は、利用者が選択したsourceだけをrevision固定URLから遅延取得し、byte length / Git blob SHAを検証してから既存Humanoid normalization経路で再生する。source単位でcacheし、モデル切替・速度・ループはsource motion数へ影響しない。

`predev` / `prebuild` には外部motion取得、全clip変換、全model走査を入れない。

## focused validation

高速DEV laneで検証するのは軽量で決定論的な契約のみ。

- source identity uniqueness
- variation/retarget/speed/mirror/trim/loop等の非加算
- provenance / license / revision / immutable hash
- unsafe source pathの拒否
- categoryと「すべて」の件数整合
- UI件数がハードコードされていないこと
- Visual Review Labのmotion routeが `review-motion.html` を指すこと
- `predev` / `prebuild` がmotion全件準備を行わないこと
- affected RINNE build

ネットワーク取得、全payload走査、全model × 全motion、Playwright/Chromium、専用evidence集約はfocused validationに入れず、そのための機能専用runner/validatorもRepositoryへ残さない。実ブラウザ操作が明示要求された場合だけ、Repository既存の一般browser-playtest経路を使う。
