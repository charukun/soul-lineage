# 襲撃先UI・捕食モーション 作業引き継ぎ

Status: RESOLVED / READY, 2026-09-12
PR: #85
Branch: feat/demon-raid-briefing-devour
Base: develop
Final renderer fix: ce7cac5514a74696ac0371935461bc1bae460322

## 実装内容

- 襲撃カードの主情報を固有村名から小規模・中規模・大規模と危険度（低・中・高）へ変更。家屋数・住人数・武装者数、危険度の理由を表示し、獲得する記憶を副情報とした。
- 生成結果も小規模6棟/8人、中規模10棟/12人、大規模14棟/16人に変更。危険度は実生成の住人数と最も強い獲物の最大HPから算出する。小規模でも強敵がいれば高危険度になる。
- 保存済みの候補ID・seed・入村履歴・再訪禁止を維持。ハウジング読込の配置は変更せず、住人数と危険度が単独狩り用の生成値であることを明記。
- 捕食の接近・到達・進行・移動キャンセル・完了時の一度だけの獲得をportableなdevour.jsに分離し、RaidSessionへ接続。捕食自体の所要時間は従来の1.5秒。
- devour-motion.js の段階別モーションを creatures.js の全身描画へ接続。腰を落とす、手を伸ばす、獲物を引き寄せる、複数の噛み込み、飲み込み、復帰を連続曲線で制御する。
- 旧来の時間ベース口パク `Math.sin(time*10)` を廃止し、捕食進捗に同期した顎・頭・胴・腕・脚・足裏・翼の姿勢へ置換。
- 捕食中の獲物は描画だけを捕食者の両手側へ寄せ、ワールド座標と衝突判定は変更しない。中断・終了時はcapture状態を解放する。

## 経路問題の解決

前回は `apps/demon/src/web/creatures.js` の更新だけが利用中の書き込み経路でブロックされ、Repositoryのblob `d31baa086e2aadcf8651fb70f8f6c222342b6c76` が旧版のままだった。

通常gitはこの実行環境で引き続きGitHub DNS解決に失敗したため、既存ポリシーどおりGitHub連携/APIへ切り替えた。前セッションのローカル作業ツリーに残っていた未反映blob `6a111278a865a3f0b450140fbfa95beec4be111c` を回収し、GitHub Contents API経路で同一blobを正常反映した。これにより描画接続のguard failureは解消した。

## 検証

Command:

```sh
node --check apps/demon/src/web/creatures.js
node --check apps/demon/src/web/devour-motion.js
node --test packages/raid/tests/hunt-presentation.test.mjs apps/demon/tests/hunt-presentation.test.mjs
```

Result: **22 passed / 0 failed**。

- 規模別40seedずつ計120ケースで表示数と生成結果の一致を確認済み。
- 選択UI単独のChromium確認は320x740、390x844、800x900で3カード表示・横はみ出しなし・キーボードフォーカス・page errorなし。
- `creatures.js` のRemote blobがローカル未反映blob `6a111278a865a3f0b450140fbfa95beec4be111c` と一致することを確認。
- この実行環境にはThree.js依存が展開されていないため、実Three.jsリグのブラウザ再生確認はIntegrationのDEV focused browser verificationへ引き渡す。実装WORKのCI待機や反復ポーリングは行わない。

main / Production、他アプリ、CI/CD設定は変更していない。
