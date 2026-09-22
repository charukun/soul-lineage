# 多対多戦闘と因縁閃き

2026-09-19のユーザー承認により、旧「生活・戦闘履歴を一切キャラクターの習得へ使わない」規定を置き換える。閃きの正本は `CAUSAL_INSPIRATION.md`。戦闘の実行・接触の権威は引き続きTidebreakにあり、本編UIを維持する。

## 成長の境界

プレイヤー自身の判断の上達と、人物の人生に由来する新しい答えを区別する。回数・経験スコア・敗北数・被弾数を技能や数値補正へ換算しない。意味の異なる生活・観察・実戦経験は、問いと解決材料として記録できる。

閃きは、身体・得物・意識・状況に適合する有限の技候補が、実行器の一連の動作と実際の接触で成立して初めて技譜に残る。名称、色、速度、威力だけの差は別技にしない。負傷は制約であり、回復後に恒久ボーナスを残さない。瀕死は必須条件ではなく、故意の被弾を習得通貨にしない。

## 維持する戦闘契約

- 武器の実軌道をワールド空間で評価する。横薙ぎは複数対象へ接触でき、非貫通の突き・射撃は最初の有効接触で止まる。
- 部位負傷は腕・脚・頭・胴の動作、判断、スタミナへ影響し、保存・復元と回復が可能。負傷自体は成長ではない。
- 敵集団の前衛、側面、後衛、撤退、援護は位置と得物で分担する。攻撃人数の人工的上限や参加権の専属化をしない。
- 敵の同一パターン警戒は戦闘内の短期記憶。戦闘終了後へ恒久学習を持ち越さない。
- 飛び道具は有限弾数、実弾道、遮蔽物、盾、身体接触を守る。近接実行器で弓の発射を偽装しない。
- 地形は射線、振り幅、間合い、高低差、退路へ影響する。壁越しに当てた扱いの閃きを認めない。
- seed、入力、位置、意識、技、接触、HP・負傷差分の軽量リプレイは検証用であり、再生によって習得や経験を増やさない。
- 自動怯み耐性、復帰無敵、人数補正による救済は追加しない。手動奥義の後隙中も敵の攻撃は進行する。
- 近接の攻防リズムは Tidebreak の実行・接触・slot を正本とする共有 Exchange Policy で解釈する。通常guard・弱い受け流しでは攻勢を継続し、強いparry・深い被弾・大きなmiss・実行不能・急完了でのみ反転または間合い読みに戻る。Exchange Policyはdamage、序破急進行、stamina、接触判定を独自に決めない。
- 多対多ではExchangeをpair単位で扱う。primary exchange中もflank/support/secondary threatの参加権を奪わず、単一の攻撃権所有者で戦場全体をロックしない。

## 継承と保存

人生ごとの技譜と、圧縮された身体傾向・技脈を分ける。子へ親の技IDを習得済みとしてコピーしない。観察は実際に見えた人物と動作の出典を保存し、系譜とは混同しない。保存された未確定の攻撃・接触・閃き窓は再開時に破棄し、会得済み技と因果記録は保持する。

旧 `combatLessons`、`techniqueEvolution`、`combatLegacy` は引き続き削除する互換対象。これらを新システムの近道として再利用しない。

## 受入条件

1. 横薙ぎと非貫通攻撃の接触差、遮蔽物、集団戦、部位負傷、有限弾数を維持する。
2. 同じ行動・かかしの反復だけで新技が増えず、準備できた兆しは後の適切な機会に実現できる。
3. 対象、技の意味ID、実行段階、支払済みスタミナ、接触が一致して初めて戦闘閃きが成立する。
4. 独立した実戦実行のテストで会得を確認し、表示名だけのイベントや保存済みポーズでは会得できない。
5. 保存移行で既知・編成済みの旧技を保持し、次代では技そのものを引き継がない。
6. 履歴、技ファミリー、技脈の計算量と保存量に上限を持つ。
7. main / Production、既存品質gate、ブラウザ検証経路を変更しない。

Depends-On: none

## Exchange / Initiative契約（2026-09-22）

近接の単位は一発ではなくpair-scopedな攻勢とする。`read → normal-start → pressure（序→破→急）→ zanshin → read` が通常経路。通常guard、weak parry、浅いslip/deflection/hitは同じinitiativeを保持する。各段の空白や受けの段でもphaseを過去へ戻さない。

共有 `packages/johakyu-combat/src/exchange-policy.js` は意味のreducerと主人公視点HUD投影のみを所有する。Tidebreakの `exchange-observer.js` は実行開始・段開始・実接触・sequence完了をpairごとに記録するbounded transient journalであり、実行器、当たり判定、stamina、damageを持たない。本編はこのjournalとsnapshotを読み、既存身体authorityの実行拒否・実負傷を同じobserverへ返す。使用回数や空のattack poseから急完了を推測しない。

### 反転と次の序を分ける

- actual strong parryは`reversal`へ移す。攻撃側の実行は既存parry motorで中断され、contact freeze、全身recoil、退き、counter windowを維持する。
- 成功した防御者のcursorはcontact時点ではresetしない。`counter-start / counter-complete`は反転の遷移であり、`settle`だけで通常pressureにはしない。
- 古いaction/reaction、counter、recoveryが終わった安全な次の通常選択でのみ、実行器のcursorを序へ戻す。反撃中の`mind / uke`は通常の序として表示しない。
- Normal開始と完了にはpairのserialを用い、反転前のaction後処理が新しい攻勢を完了・再開させない。
- strong判定は実接触、実防御intent、counter、攻撃phase/impactと身体能力に基づく。initiative owner自身が圧の途中で行う軽いinterceptionを、自分自身への攻守反転にしない。shallow slipはstrongにしない。乱数は使用しない。

深い接触（既存heavy/HP比・身体結果）、major miss、実行不能、incapacitation、disengage、target invalidationはREADへ戻す。これらを攻勢完遂の残心と偽らない。通常急の全段を完了したownerだけに`completedBy`を付けて残心とし、相手の完了を主人公の右波形へ投影しない。

### 境界

HUDは`johakyuExchangeHudState`を本編とreviewで共有する。相手initiative、守勢、strong parry直後、counter transitionは左波形。自分の通常攻勢中だけcanonical slotを表示し、自分の急完遂のみ右波形。通常被弾のlegacy interruption animationは、継続中のpressureを消さない。

Tidebreakの防御を含む編成済みrecipe、attackId、実軌道・接触時刻・target lock・world contactを維持する。stamina不足や腕/脚の機能制限は既存stage/technique capabilityで拒否し、initiativeを理由に通さない。周囲の敵のflank/support/retreat/secondary contactをpairでロックしない。projectile、finisher、因果閃きの実行・接触・支払条件は別の既存authorityを維持する。

保存時は現在combatのcursor/target/queue/pose/exchange/counter/残心を破棄し、HP・部位負傷・stamina・装備・技譜・恒久因果記録を保持する。ロードはREADから始める。live stateはserializeによって変更しない。

Secondary pair completion/failure must not request a cursor restart for an actor who is still pressing in another pair. The shared restart-participant policy enforces this for native Tidebreak and the review adapter. An authored parry intent is directed at the executor's actual target lock: incidental blade contact from another opponent is a light deflection, not an invented strong reversal toward an unauthored target. Real decisive interruptions remain executor cleanup events.
