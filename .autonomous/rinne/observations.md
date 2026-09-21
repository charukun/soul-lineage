# 百年転生 観測

## R-001: portable life-clock probe

`apps/rinne/public/simulator/src/life-clock.js` はbrowser/storage/rendering依存を持たず、年齢進行・速度・外見stageを固定fixtureで比較できる。これは人生時計の限定probeであり、出生から転生までの本編loop、戦闘、保存、UI品質を代表しない。

## R-002: 本編観測はimmutable staging優先

改善候補は `apps/rinne` のexact source SHAをPer-App DEV Publishへ渡し、Cloudflare Worker Version Previewへ固定して観測する。mutable latest DEV、review-only画面、別SHAの動画を本編Before/Afterとして代用しない。

## 外部feedback

ユーザー報告は原文、受領日時、対象画面/版、再現条件を保持し、staging/source Evidenceと区別する。
