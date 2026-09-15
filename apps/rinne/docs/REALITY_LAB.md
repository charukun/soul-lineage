# RRPの軽量通信実験室

入口: `reality-lab.html`。rinneの既存Vite/DEV配信に含む独立ページ。Canvas 2Dと既存networkの公開APIだけを使い、本編・Three.js・3Dモデル・本編保存を読み込まない。新規依存、常設サーバー、外部API、課金サービスは追加しない。

## 議論と検証のループ

1. 今回壊す仮説を一つ書く。
2. seed、人数、配置、片道遅延、揺らぎ、欠落率、障害を決める。
3. 同じ条件で全体配信 / Interest配信 / Cell分散を比較する。ゆっくり再生では方式を切り替えて観察できる。
4. 配信量だけでなく、停止・巻戻し・誤差・未受信数も確認する。
5. 観察を書き、結果JSONまたは端末内記録へ保存する。
6. 「議論用テキスト」をChatへ渡し、結果が支持する範囲と模型の省略を区別して議論する。
7. 過去の記録/JSONから条件を戻し、一変数だけ変えて再実行する。理論を増やす前に反例を残す。

このループは人とAIが結果を往復するための実験導線。独自の自動修復WORK、無人AI評価、定期実行、外部送信は追加しない。次の実装変更も最新developから通常の短寿命WORKで行う。

## 実行

```sh
npm ci
npm run dev:rinne
# http://localhost:5173/reality-lab.html
node apps/rinne/scripts/reality-lab.mjs
node apps/rinne/scripts/reality-lab.mjs --config '{"scenario":"steady","layout":"dense","loss":0,"latencyMs":0,"jitterMs":0,"durationMs":16000}' --out /tmp/rrp-dense.json
node --test apps/rinne/tests/reality-lab.test.mjs
```

Chromium導入済みの検証環境では、Labを起動して `RRP_LAB_URL=http://localhost:5173/reality-lab.html node apps/rinne/scripts/reality-lab-browser.mjs` で390px幅の操作・結果保存・JSON往復・中止を確認できる。この操作検証はモデルのNodeテストとは別であり、ブラウザを起動できなかった実行を成功として数えない。

公開候補URL: `https://charukun.github.io/soul-lineage/dev/rinne/reality-lab.html`。実装WORKのReadyと公開済みは区別する。既存Integrationが統合・DEV公開を担当する。

## 模型の境界

- 3〜30の模擬参加者と18 NPC。50ms固定の仮想時間、自律した往復移動。同じseed/条件/コード版なら同じ結果。
- 全体配信は全個体を20Hzで配信。Interestは既存 `presencePolicy` / scheduler / quantisationを利用する。
- Cell分散は同じInterest条件の配信元をCell担当へ移す。時計/Cell報告/バックアップのpayloadも数える。ただしこの版のcoordinatorは単一プロセス内で権限を決めるため、分散合意の検証ではない。
- 未観測NPCは位相・速度・最後の世界tickを保持。観測時の閉形式による位置復元を、初期状態からの逐次加算と照合する。これはこの移動規則の検証であり、戦闘・生態系一般の復元可能性の証明ではない。
- `dragon-1`という遠方の兆しを空間Interest外にも配信する。規則で明示した一つの因果購読だけを検証し、未来の因果推論を実装したとは言わない。
- 模擬wireはJSONを実際にserializeしたpayload byte数を数え、独立欠落と片道遅延/jitterを適用する。SCTP、再送、暗号化header、NAT、TURN、輻輳、burst lossはモデル化しない。
- ページは単一端末内で3方式を計算する。実CPU/RAM・電池・背景停止の耐性は未計測。`actorUpdates`は計算回数であってCPU時間ではない。
- 親子・出生・死亡・所有権・Cloud Commit・不正耐性は次段階。checksumは非暗号学的な破損検出用で、改造クライアントは再計算できる。

## 障害と復旧

Hostシナリオは経過8秒にHostの実行・通信・手元Checkpointを失わせる。既存lease期限後、coordinatorがdisconnectを認定して既存状態機械へ渡す。候補は接続済み端末のバックアップから、要求されたrevisionの実データを復元する。coordinator内にあるCheckpoint本体をバックアップ代わりに使わない。

初版の復元処理時間は仮想500msという仮定。候補にデータがなければ他の生存バックアップから模擬wire経由で要求revisionを転送する。最新revisionが全バックアップで欠けていれば、以前のrevisionへ無断で下げずtimeoutでclosedになる。

停止中は世界tickを進めない。復旧Checkpointまでの一時状態の巻戻しは隠さず計上する。経過20秒に元Hostを空の受信状態で再接続する。16秒の実験ではこの再接続は発生しない。

Cell担当の切断は8秒、単一coordinatorが次の刻みで再割当て。一般のCell移譲barrierを完成させたとは扱わない。破損シナリオは8秒以降のsnapshotを一つ破損し、checksum不一致→修復要求→再送を同じ模擬wireで通す。破損パケット自体が欠落すれば検出0件になることも正しい結果。

再訪シナリオは世界6秒に最後の参加者がCell 3へ、10秒にCell 1へ、14秒にCell 3へ移る。全員集合の配置で試すと未観測→具体化→未観測→再具体化を観察できる。

## 指標と証拠

- `primaryKbps`: その時々のPrimary役が送った総payload / 仮想経過秒 / 1000。Host交代前後を合算する。
- `maxPeerKbps`: 各端末の全期間平均uplinkの最大。瞬間ピークではない。
- `byPeer`: 端末別tx/rx。`byKind`: snapshot/Checkpoint/修復/調整等の送信量。
- `darkMs`: Host実行停止・権限不在による世界停止。lease故障判定待ちも含む。
- `migrations`: Host消失から復元完了までの仮想経過。`rollbackMs`: 一時状態の戻し量。
- `meanPositionError`: 同じ区画の受信済み個体位置と現在の正解位置との差。`missingSamples`も確認し、未受信を誤差ゼロとして解釈しない。
- `collapseMatchesReference`: このNPC移動規則の逐次計算との一致。正史や暗号の検証ではない。
- 結果にはconfig、model version、build commit/inputHash、仮説、観察、方式別イベントと時系列を保存する。記録元SHAは結果の出典であり、次の変更の正本を古いSHAへ戻す指示ではない。
- JSON読込みは条件とメモだけを復元する。持ち込んだ集計値を現在の計測として表示しない。再実行が必要。
- 端末内保存は本編と異なる環境別キーで最大10件。保存失敗を成功表示しない。クラウド同期はない。

## 次の実験を追加する基準

先に問いと棄却条件を決める。例えば「密集時の配信分散が必要か」ならRelayを一つ追加してhopとpayloadを測る。「現実の回線で成立するか」なら既存peer adapterを接続し、実WebRTCのstatsを別の証拠種別として扱う。模擬wireの係数調整だけでNAT/TURNや不正耐性を実証したことにしない。
