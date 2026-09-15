# Peer Checkpoint Sync

Peer-hosted共通世界のAuthorityとHost Migrationは、復元可能な完全checkpointを正本として維持する。通信だけを `full base + bounded delta journal + revision catch-up` にする。

通常の友人招待は引き続き外観のみを共有する見学専用であり、完全checkpointやsaveを訪問者へ送らない。この差分同期は明示的にhost eligibleなpeer共通世界・その検証経路に適用する。

## 目的

MURAAAAAAA Hostは通常約2秒ごとにcheckpointを更新する。毎回full snapshotを全peerへ送らず、最初の完全checkpoint以降は変更分だけを送る。packet lossや一時切断でrevisionを取り逃したpeerは、保持している最後のrevisionから追いつく。

## Protocol

- `world-checkpoint`: 初回、cold sync、journal範囲外のfull fallback。
- `world-checkpoint-delta`: `fromRevision -> toRevision` の連続1revision差分。
- `world-sync-request`: peerの `knownRevision` / `knownDigest` をHostへ通知する。
- `world-checkpoint-catchup`: `none | delta | full` のいずれかを返す。

通常のAuthority stateは従来どおりfull checkpointを保持する。Host Migrationのquorum、epoch fence、闇演出、split-brain fail-closed条件は変更しない。

## Delta journal

Network journalはlocal save journalと別責務である。

- Entity IDを持つ配列はentity単位で `set / patch / delete` する。
- 一般objectは再帰merge patchを使う。継承propertyを辿らず、受信patchでprototypeを変更しない。
- Entityの並び替え・途中挿入・重複IDでentity操作だけでは順序を再現できない場合は、その配列を置き換えて完全なround-tripを維持する。
- revisionは必ず連続する。
- base/result digestで取り違えや破損を検知する。
- digestは通信整合性チェックであり、暗号学的署名・認証の代替ではない。
- journalは24 entriesまたは約700KBでcompactし、最新full checkpointを新baseにする。

## Recovery

1. deltaの `fromRevision` が手元のrevisionと一致すれば適用する。
2. revision gap、base digest不一致、result digest不一致では状態を推測しない。
3. peerは現在Hostへ `world-sync-request` を送る。Hostは同じworldへ参加済みの接続peerだけに返し、終了済みnodeは応答しない。
   delta/catch-upのepochと現在のauthorityが一致しない場合はjournalを更新しない。
4. Hostがknown revisionをjournal内に保持していれば連続deltaだけを返す。
5. known revisionがcompact済み、cold start、または安全に再構成できなければfull checkpointへfallbackする。

Cold restartを高速化する目的で巨大なworld snapshotを追加永続化しない。既存save/checkpoint境界を増やさず、一時的なnetwork断からの復帰を主対象にする。

## Host Migration

Host交代時はcandidateが最後の完全checkpointを復元してからOPENになる。新epochの最初のcheckpoint publish時にjournal epochを安全にrebaseする。移行中に安全なbaselineが存在しない場合はdeltaを生成せずfullを使う。

## Diagnostics

`node.snapshot().checkpointSync` に次を公開する。

- `baseRevision / latestRevision / entries`
- `journalBytes / fullBytes`
- `fullSentBytes / deltaSentBytes / catchupSentBytes`
- `catchupRequests / fullFallbacks / appliedDeltas / digestFailures`
- `lastCatchupMs`

これらはPerformance/PULSE連携で最適化効果を確認するための診断値であり、ゲームAuthorityには使わない。
