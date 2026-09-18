# RRP — 本編へ接続した確定境界

対象は招待制の30人規模試遊。`reality-lab.html`の模型ではなく、タイトルの「友達と遊ぶ」から使う `CoopWorld` / WebRTC sessionへ組み込む。

## 現在有効な処理

- `checkpoint-writer.js`: 20Hzの世界更新から保存待ちを分離。同時書込みは1件、後続は最新1件へ集約する。ACK後にのみ確定projectionを更新する。
- `history.js`: 出生、寿命終了、転生の構造を検査。前世の記録・終了状態・generationの巻き戻しを拒否。転生要求は元の人生IDに結び付け、同じIDの違う内容は拒否する。
- `history-store.js`: 注入したstorageと世界単位の排他lockを使うWeb端末adapter。checkpoint、履歴、転生要求、revisionを同じJSONへ原子的に書く。SHA-256で破損を検出。応答消失時は同じwrite ID/rootを再読して確定を判定する。
- `session.js`: 新しく生まれる/終わる/転生する人物の未確定結果を配信しない。他の人物は更新を続ける。未確定の出生/転生は進行させず、入力も受け付けない。これは世界時計を別サービスで確定する実装ではない。
- `guest-session.js`: 実際の保存後に転生応答を返す。人生IDとhistory revisionを確認し、旧要求/旧表示で新しい人生を上書きしない。
- `runtime.js`: tickが変わらなくても履歴revisionの更新を適用する。保存中の人生には短い状態表示を出し、終了が未確定なら転生画面を出さない。

保存が3秒を超えた場合は世界全体を停止して闇へ移る。確認成功で再開、明確な保存失敗では停止を維持して確定記録から開き直す。手動pause/非表示による停止は保存完了で解除しない。

## 保存と復旧

新形式は環境・gameId・playerIdでscopeされた `coop-v2:<worldId>`。ソロの`life-v2`とは独立。旧形式はv2がない場合だけ読み、最初の確定記録をHost由来の起点として残す。過去の端末保存をサービス検証済みの歴史とは呼ばない。

保存単位は `{version,revision,writeId,intentHash,checkpoint,history,root}`。転生要求はcheckpoint内の`world.rebirthOps`に保持する。通常checkpointごとに歴史イベントを増やさず、出生/終了/転生のときだけappendする。乱数にはauthority Epochを加えない。村を開き直すとEpochを進め、旧Epochの書込みを拒否する。

現adapterでは履歴とcheckpointが同じ原子的記録にあるため、利用可能な履歴より古いcheckpointだけを採用する経路はない。保存提案が確定した時間・人生・系譜を後退させる場合は拒否する。記録の破損では過去の別スロットへ黙ってfallbackしない。

ブラウザデータ削除や端末故障で全記録を失う可能性は残る。端末保存のrollback攻撃、同一originの改造コード、ゲーム結果を偽造するHostを信用できるようにはしていない。kernelの形式/遷移検査とゲームプレイの正当性は別問題。世代を跨ぐ本人認証も現行の再接続券の範囲。

## 外部サービスへ差し替える場合

`save(checkpoint)`は不変のコピーを受け取り、durableな確定後にのみresolveする。応答不明では同じ操作IDを照会し、安易に取り消さない。API/SDKはadapterへ置く。

本物のクラウド版では、外部から認証したplayer/world ID、サービス側のlease/Epoch、サービス時計、一意な転生要求、認可した所有移転を同一transaction内で検査する必要がある。現Web adapterの`capabilities.cloud`と`authenticatedAuthority`は明示的にfalse。これをtrueへ変えるだけでクラウド実装にしてはいけない。

同じHostへの再接続は有効。別Hostへの自動移譲には、fencingサービス、共有checkpointの実データ、signalingによる接続し直しが必要。端末間多数決で代用しない。TURN、Cell Authority委譲、未観測世界のmacro復元、社会関係の因果購読、公開対戦の不正防止はこの段階では有効化しない。

## 検証ループ

```sh
node --test apps/rinne/tests/coop-history.test.mjs apps/rinne/tests/coop-session.test.mjs apps/rinne/tests/coop-world.test.mjs
```

局所テストは実ゲームdomain、CoopWorld、保存adapter、sessionを使用する。memory RTC fixtureの通信はSCTP/NAT/TURNの証拠ではない。実WebRTC loopbackは `coop-rtc-probe.mjs`、WebGL/ブラウザ操作は既存 `coop-play.browser.mjs` で別に行う。browser gateは端末保存の新形式と同一Host復旧時の出生履歴の維持も確認する。

次の境界変更では失敗する最小シナリオを先に追加する。cloud保証は実サービスでの故障注入後、30実機の性能は実機測定後にのみ報告する。モデルの検証数や単一PCの速度を、それらの代わりに使わない。
