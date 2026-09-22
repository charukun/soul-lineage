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

## Exchange boundary contract (2026-09-22)

- `packages/johakyu-combat/src/exchange-policy.js` is the shared pair-scoped interpreter. `normalStarted`, `completedById`, and `transition` distinguish ordinary pressure, reversal/counter, and the actor that actually completed 急. It never pays stamina, resolves contact, writes a combat cursor, or awards inspiration.
- Native Tidebreak emits committed stages, classified real parries, counter start/completion, interruption, and **whole-sequence** 急 completion. An empty attack between stages is not completion. Main-game physiology interprets actual HP/injury outcomes and feeds the same pair projection back to native AI selection.
- Ordinary guard, weak parry, shallow hit, and shallow miss retain pressure. A deep hit is an actual incapacitating outcome, newly compromised body when a before/after outcome is available, unguarded heavy impact, or at least 16% of maximum HP in an impact. Major miss, failed execution/capability, disengagement and target invalidation return to READ, not the successful-completion wave.
- Strong parry creates REVERSAL. Reaction and counter callbacks finish on their original cursor; only the next normal sequence boundary prepares 序. Counter is never silently relabelled 序. Native authored RINNE defense stages must not be stripped by standalone generated-recipe cleanup.
- Hero HUD reveals canonical jo/ha/kyu only during the hero's normal PRESSURE, including gaps between clips. Opponent pressure, defense, reversal, and counter show 間合い. Only the hero's own whole 急 completion shows 残心; opponent completion stays 間合い.
- Pair pressure influences AI intent, not battlefield-wide attack rights. Secondary sessions/world contacts and squad roles continue. Projectiles, special one-motion/finisher execution, injury costs, and actual-contact inspiration keep their existing authorities.
- Exchange, deferred normal-start state, native events, reaction/counter windows and HUD projection are transient. Restore starts at READ; physiology, loadout, learned techniques and causal records remain persistent.
