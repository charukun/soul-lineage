# 本編・音楽の統合候補（DEV限定）

Base: PR #20 merge 97c6e8a6dd6a1cfa243f1d893417f0451f35ffa6。
本変更は大容量モデルのCodespaces送信待ち。ローカル検証をDEV公開成功と扱わない。

## 実装

- apps/rinne: 軽量WebGL2タイトルからTidebreak Expandedを遅延起動。実工程/バイト/モーション数の進捗、失敗詳細、再試行、タイトル復帰。公開済みの手動P2P参加をタイトルの「村へ参加」に保持。
- Lifecycle: 実60秒/年、0歳開始、90歳寿命、最大20倍、敵ON/OFF。時計の加速は移動/戦闘を加速しない。年齢・頭身・白髪・姿勢。DEV/local/prodで保存キーを分離。過去の無印キーは書き換えず、新規キーから開始する。
- 最新ReferenceTimed Shino v3: シミュレーション時計で所有する足接地、離足の補間、手/武器ソケット、武器半寸、軌跡、命中演出をLoading Fix 2/Lifecycleへ統合。
- Shino: 共通キャラクター/遺伝/衣装配色/同期検証契約と30体描画pool。本編初期モデルはSHINO。設定から独立したキャラクター確認ページ（1/30体、年齢、配色）を開ける。モデルの元バイトとライセンスを保持。
- BGM150: packages/audioを共通正本とし、3ゲームの「音楽室」から検索、世界絞込、お気に入り、再生/停止/シーク/音量/ループ。ZIP選択不要、1つのHTMLAudioElementで選択曲だけ取得。DEV試聴のみ、ProductionではUIを起動しない。音源の商用承認状態は変更していない。
- 既存villageHostLabリハーサルは専用入口へ保持。本物の認証サービスと誤称しない。

## 検証と未完了

単体/境界/3app buildの実ログをhandoffに保存する。公開Chromium gateはタイトル→実モデル起動→実戦闘→世界設定→タイトル復帰とBGM再生に更新した。村/魔物の既存gateは維持。

この環境のCloud BrowserはlocalhostをERR_BLOCKED_BY_CLIENTで拒否した。制限を迂回しないため、新しいUIの実ブラウザ確認は未実施。CIへのpush後に通常の検証を行うこと。

Shinoのraw glTF poolは独立した描画基盤レビューであり、本編VRMのMToon/表情/揺れ物と同等の完成品とは主張しない。衣装は3配色で新規服形状ではない。CharacterReplicaは契約と検証までで、既存P2Pへキャラクター状態を運ぶ機能はまだ接続していない。30体のPixel Fold実機測定、見た目の最終承認、全曲の聴感/商用権利承認は未完了。

## 送信

`node scripts/check-push-route.mjs origin/develop HEAD` は5モデル（11.5–17.7MiB）を検出しCODESPACES_GIT。既存ルールに従ってconnectorで分割/Base64再送しない。bundleを同じbranchへ取込んで通常git pushを行う。未検証のため最初はDraft PRとし、画面確認/CI成功後にReadyへ変更する。Integrationは所有者承認記録・最新head/CI/artifact/review/競合確認・expected-head merge・integration/develop成功までが完了条件。

main/Productionは一切変更しない。
