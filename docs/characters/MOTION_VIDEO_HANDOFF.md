# Motion video handoff

## 目的

ユーザーがモーション変更後に「動画ください」と求めた時、実装セッションが簡易図や棒人間をその場生成するのではなく、対象PRのexact-headで実WebGLキャラクターを再生した動画artifactを即座に取得して渡せるようにする。

## 契約

- 百年転生のcharacter motionに影響するPR browser smokeは、既存Motion QAの実WebGL経路を使って30秒レビューを1倍速で録画する。
- 録画対象はRepositoryの実モデル・実rig・実motion runtimeであり、代替スケルトン、簡易図、別キャラクターを動画証拠として扱わない。
- 動画は `test-results/pr-browser/motion-preview/` 配下へ保存し、既存 `pr-browser-<pr>-<head>` artifactに同梱する。
- exact head SHA、model ID、motion revision、再生速度、録画範囲をreceipt JSONへ記録する。
- 録画の成否は既存Motion QAのassertionを弱めない。動画生成のために既存browser gate、visual approval、gameplay timingを変更しない。
- 動画artifactは人間が見た目を確認する証拠であり、自動的なVisual Approvalにはしない。

## Astra / ChatGPT からの利用

ユーザーが「動画ください」と依頼した場合は、対象PRのcurrent exact-headを取得し、そのheadに対応する `pr-browser-<pr>-<head>` artifactから `motion-preview` 動画を取得する。古いheadの動画や構成図を代用しない。

artifactがまだ存在しない場合は、既存PR browser playtest経路へ引き渡されていることを明示する。存在しない実動画を生成済みと扱ったり、簡易アニメーションを実WebGL録画として渡したりしない。

## 対象判定

少なくとも次の変更はMotion QA動画対象にする。

- `apps/rinne/src/character-motion-*`
- `apps/rinne/tests/character-motion-*`
- `apps/rinne/public/simulator/src/authored-slash*`
- `apps/rinne/public/simulator/src/humanoid*`
- `apps/rinne/public/simulator/src/motion-*`
- `packages/animations/src/motion-*`
- `packages/animations/tests/motion-*`

通常の非モーションPRへ録画コストを広げない。
