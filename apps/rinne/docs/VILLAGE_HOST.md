# 村長端末Host基盤

@soul/network の状態機械が村の権限を管理し、ゲーム本体は open の間だけ世界時間とsimulationを進めます。描画loopは権限状態から独立しているため、Host切断中も画面と闇の演出は継続します。

- 村長をPrimary Hostとし、村長が接続中の open 状態だけ新規参加を許可する。
- Host lease切れでepochを更新し、古いHostのheartbeatとCheckpoint書込みを拒否する。
- Migration候補は接続中かつHost可能な村人から決め、最新Checkpointのrevision確認後に再開する。
- 候補が尽きるかtimeoutすると村を closed にする。村長復帰も同じ同期barrierを通す。
- Checkpointは世界時間、World State、キャラクター、NPC、乱数状態のためのversion付きEnvelopeとし、件数・byte数・entity ID・座標を検証する。

現在のWebアダプターはbackend未接続時の開発リハーサルです。同じoriginの複数タブで BroadcastChannel、localStorage、navigator.locks をtransport代替として使います。正式サービスではこのアダプターを認証済みrealtime transportとserver側のlease/epoch判定へ置換し、状態機械とゲームの停止・復旧境界は維持します。クライアントCheckpointは権威の証明として信用せず、server検証、署名、操作log、rate limitを追加します。

## 開発リハーサル

1. ?villageHostLab=mayor を開く。
2. 同じbrowser profileで ?villageHostLab=villager を開く。
3. Consoleから村長側の await __VILLAGE_HOST_LAB__.disconnect() を実行する。
4. 村人側で闇の間は canvas の worldTimeMs が止まり、Checkpoint適用後に代理Hostとして再開することを確認する。
5. 村長側の __VILLAGE_HOST_LAB__.reconnect() で安全に復帰する。

__VILLAGE_HOST_LAB__.state() で hostId、phase、epoch、revision を確認できます。この入口はquery指定時だけ有効で、通常のゲーム起動にはlocal通信や演出を追加しません。
