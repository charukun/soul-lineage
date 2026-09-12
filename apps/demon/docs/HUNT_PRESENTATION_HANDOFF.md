# 襲撃先UI・捕食モーション 作業引き継ぎ

Status: BLOCKED / PARTIAL, 2026-09-12
PR: #85 (Draft)
Branch: feat/demon-raid-briefing-devour
Base: fca7eeac3ddb143f0ae2a24bb28a167dfae8954f
Implementation/test checkpoint before this handoff: 2039f802eb6f07ff912c81e3d825973f2635bf3f

## Repositoryへ反映した内容

- 襲撃カードの主情報を固有村名から小規模・中規模・大規模と危険度（低・中・高）へ変更。家屋数・住人数・武装者数、危険度の理由を表示し、獲得する記憶を副情報とした。
- 生成結果も小規模6棟/8人、中規模10棟/12人、大規模14棟/16人に変更。危険度は実生成の住人数と最も強い獲物の最大HPから算出する。小規模でも強敵がいれば高危険度になる。
- 保存済みの候補ID・seed・入村履歴・再訪禁止を維持。ハウジング読込の配置は変更せず、住人数と危険度が単独狩り用の生成値であることを明記。
- 捕食の接近・到達・進行・移動キャンセル・完了時の一度だけの獲得をportableなdevour.jsに分離し、RaidSessionへ接続。捕食自体の所要時間は従来の1.5秒。
- 捕食の段階別モーション曲線、UIおよびライフサイクルの局所テストを追加。

## 未完了と停止理由

apps/demon/src/web/creatures.js の更新が、OpenAIのツール側安全性確認によりブロックされた。詳細な拒否理由は返されていない。この書き込みは成功しておらず、Repositoryの描画処理は旧版のまま。

Remote creature blob: d31baa086e2aadcf8651fb70f8f6c222342b6c76
Local unreflected creature blob: 6a111278a865a3f0b450140fbfa95beec4be111c

devour-motion.js は存在するが、全身描画への接続は未完了。捕食の表示改善を実装済み・公開済みとは扱わない。Ready化・merge・DEV公開は行っていない。main / Production・他アプリのコード・CI/CD設定も変更していない。

通常gitはこの実行環境のGitHub DNS解決で失敗し、GitHub連携APIでテキスト変更を反映した。今回の停止はAPIサイズやgit認証の問題ではなく明示的な安全性確認ブロックのため、別経路や別形式で拒否された書き込みを迂回しない。

## 実施した検証と限界

Command:

```sh
node --test packages/raid/tests/hunt-presentation.test.mjs apps/demon/tests/hunt-presentation.test.mjs
```

- 未反映のcreatures.jsを含むローカル作業版: 22 passed / 0 failed。
- creatures.jsをRepositoryの旧版へ戻した現在のPR相当: 21 passed / 1 failed。失敗は描画への接続を確認するguard testであり、未完了箇所を正しく検知している。テストを弱めて成功に見せていない。
- 規模別40seedずつ計120ケースで表示数と生成結果の一致を確認。
- chooserだけを分離したHTML/CSSをChromiumへ読み込み、320x740、390x844、800x900で3カード表示・横はみ出しなし・キーボードフォーカス・page errorなしを確認。
- 変更JSの構文チェック、既存ファイル差分の適用/空白チェックを実施。
- ローカルは必要ファイルを取得した部分ワークスペースで、完全な依存関係インストールやapp全体ビルドは未実施。Three.js実リグの全形態検証、ゲーム内の実動画確認、公開DEVでの検証は未実施。モーション曲線のテストは実ゲーム表示の確認に代わるものではない。
- CI完了の待機や反復ポーリングは実施していない。

## 再開条件

このbranch/PRと最新developとの差分から再開する。ツール側の拒否が解消され、正規に許可された操作で続行できる状態になってから未反映の描画処理をレビューする。接近中に旧口パクが残らないこと、全身の接地、中断/再開/完了時の姿勢リセット、各形態、描画だけの獲物移動を確認する。

その後、上記テストと実リグ検証・必要最小限のビルド検証を実施し、成功を確認して初めてReady化する。CI監視・develop統合・DEV公開はIntegrationへ引き渡す。
