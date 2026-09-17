# RRP: 量子力学・哲学を使う反証ループ

入口は [REALITY_LAB.md](REALITY_LAB.md)。この文書は発想と検証手順の追加であり、新しい物理法則、量子通信の実装、RRP全体の安全性証明ではない。通常の古典計算機・WebRTCを前提とし、量子ハードウェア、外部サービス、課金を追加しない。

## 「この世の理」を設計へ移す際の区別

物理学の結果、量子力学の解釈、哲学的思想、RRPが選ぶゲームの公理、実装上の仮説、実行された証拠を別々に記録する。哲学から得た世界の捉え方を、実宇宙の法則が証明されたことにはしない。解釈を変えても古典通信の制約が消えるとは扱わない。

候補原則は「全端末の内部表現を同一にするより、許された観測・相互作用・確定済みの因果が矛盾しないことを守る」。ただし、内部差を捨てられるのは、その差が将来の観測やCanonへ影響しないと示せる範囲だけ。これは採用済みの通信保証ではなく、以下で壊しにいく仮説である。

## 量子力学からの3つの問い

### Q1: 観測者が実際に持つ情報は何か

着想: Rovelliの関係的量子力学は、系について他の系が持つ情報を中心に記述する解釈を提案する [Q1]。唯一確定した解釈として採用せず、人の意識が世界を作るという意味にも使わない。

RRP仮説: nodeの判断を、そのnodeの永続状態、受信履歴、ローカル時計の観測、固定した乱数入力だけの関数にする。同じ局所証拠なら、未受信の遠隔状態だけを変えても送信・昇格・commit判断は変わらない。

反例: Hostがcrashした世界と、Hostは生存しているが通信が遅れている世界を用意する。peerの受信履歴と時計入力を揃えたまま、simulatorのglobal aliveを参照して片方だけ安全に昇格できたら失敗。omniscientな観測器は検査側にのみ置き、protocolへ情報を逆流させない。

比較先: 古典的な局所状態機械、障害検出器、メッセージ因果モデル。因果順序はLamport等の既知研究を基準にする [C1]。これを量子通信とは呼ばない。

### Q2: 未観測の細部をどこまで粗くできるか

着想: decoherent historiesでは、粗視化した履歴と古典的予測可能性の条件を検討する [Q2]。decoherenceはquorum ACKやdurable commitと同じ現象ではない。

RRP仮説: 未観測NPC等を細かい状態そのものではなく、将来の許可された操作で区別できない状態の集合として保持する。ただし画面、音、他peerとの照合、所有権、因果的な結果、保存・再訪・転生後の照会まで観測契約に含める。

反例: 今は同じ画面でも、遠隔NPCの違いで後から物資や報酬が変わる。平均が同じでも2人が比較した記録の相関が違う。不可逆履歴は画面に出なくても削除不可。「誰も見ていないから無かったことにする」は棄却する。

比較先: 古典的な観測同値、状態機械の縮約、遅延評価、既存Collapse。partition refinement自体は既知技術 [C2]。同じ縮約を比較相手にも許し、量子由来という名称に性能点を加えない。

### Q3: 相関は通信そのものか

物理的境界: 量子テレポーテーションにも共有エンタングルメントと古典通信が必要である [Q3]。遠隔側の局所操作を平均したときの局所状態不変性と、結果を通信して条件付けた状態は別物。

RRP仮説: 事前共有seedと規則で再生成できる環境変化は、差分だけ送る候補にできる。ただし相関の準備、seed配布、checkpoint、再同期の費用を含める。共有seedは古典的相関であり量子もつれではない。

反例: 共有後に相手が自由に選んだ未知の入力を、受信なしで判定できたら、隠れた通信または全体状態参照を疑う。各peerの周辺分布だけでなく共同分布と時間相関を比較する。予測が当たったことを未受信入力の確定とは数えない。

比較先: deterministic generation、delta encoding、lockstep、共通乱数。実際の量子resourceを持たない現構成に量子優位・超光速通信・無通信合意を主張しない。

## 哲学的思想からの3つの問い

### P1: 縁起・条件依存から因果の保存を問う

SN 12.20は縁起という条件関係と、条件によって生じた現象を区別する [P1]。これは思想上の着想であり、量子力学やコンピュータ科学の定理ではない。

RRPへの設計案: 距離だけでInterestを切らず、「何が何の成立条件か」を追う。遠方の行動でも、現在の資源・生死・系譜へ届く因果があるなら保存または伝達する。反例は、非表示の資源生産を捨てた後の取引、原因の受信前に結果だけ公開する順序、循環依存や動的な依存追加。因果情報を保持する費用と依存グラフの完全性は未証明のまま隠さない。

### P2: 同一性を見た目ではなく履歴と関係から問う

ここは特定の哲学者の定理の引用ではなく、同一性についての哲学的問いをRRPの契約にする工程。「同じ顔」「同じ最新値」と「同じ人生・所有権・受理済みの過去」は別である。

RRPへの設計案: life ID、operation ID、authority generation、因果履歴を保存し、表示や内部表現だけを交換する。反例はactivation二重実行、同じ操作種別の別request、元clientが戻らない不確定完了、同じ最新画面に至る異なる出生履歴。既存のidempotency/replicated-log方式と同条件で比較する。転生の存在を物理学で証明したという扱いはしない。

### P3: ヒュームの帰納への疑問から検証完了を問い直す

ヒュームは経験から未観測の事実を推論する根拠を問う [P2]。RRPへの応用は、過去の成功例や列挙済みchecklistを未知のケースの不存在証明にしないこと。

主張ごとに前提、範囲、量化対象、棄却条件、反例探索の上限を先に固定する。正しい実装だけでなく、意図的に安全条件を外した比較実装を独立の検査器が拒否するか確認する。実装と同じ式を再計算しただけの自己一致を、独立した正しさの証拠と区別する。

## 既存ループへの挿入順

1. 六つの視点から候補を出し、今回壊す仮説を一つ選ぶ。毎回すべてを実装しない。
2. 下記カードに出典とRRPへの移し替えを別々に書く。
3. 最小反例と、同じ最適化を許した既知方式の対照を先に用意する。
4. 同じ入力、故障、codec、保存条件、回復品質、測定区間で一変数比較する。
5. 外部履歴検査器で安全性を調べ、意図的な誤実装が落ちることも確認する。
6. 理論上の条件付き結果、model実行、実通信、実機結果を分けて残す。
7. 結果を仮説へ戻す。反例が出たら前提を黙って狭めず、主張を撤回または明示改訂する。

カード必須項目: `source / sourceKind / hypothesis / transferAssumptions / observationContract / canonInvariant / matchedClassicalBaseline / falsifier / independentOracle / metricsAndUnits / executionReceipt / unresolved`。

`sourceKind`は物理的結果、量子解釈、哲学的思想、工学的仮説のどれかを明示する。カードが埋まることは事務的な完全性であり、安全性や理論飽和を証明しない。

## 最初の検証補助: 有限観測モデル

`src/game/reality-lab/observation-quotient.js` は古典的・有限・決定的な完全遷移表だけを扱う。状態は `id / observation / canon / transitions`、遷移は各actionについて `to / output` を宣言する。`canon`は未表示でも保護する契約。返却結果はmodelの同値類であり、通信プロトコルではない。

定義: xとyを同値とするには、observationとcanonが等しく、全actionで遷移出力が等しく、次状態も同値でなければならない。固定点まで分割することで、その有限モデルの任意の長さのaction列について一致を検査する。hash一致だけで本文一致を代用しない。

独立検査は、2状態の積グラフを探索し、異なる観測・Canon・遷移出力を生む最短action列を探す。現在画面だけを比較する誤実装、Canonを無視する誤実装、将来の相互作用を見ない誤実装を拒否することも試す。

確率分布、連続座標、部分観測ゲーム全体、実際の保存・復旧はこの補助の証明範囲外。特にseedをactionへ置き換えるだけでは量子相関や確率保存の証明にならない。観測契約に入れ忘れた依存は検出できないため、契約を広げて再検査する。

```sh
node --test apps/rinne/tests/reality-observation-quotient.test.mjs
```

この局所検証の成功を既存compiler、Canon、handoffの修正完了として扱わない。PR #716の監査指摘とDraftは別件として維持する。状態数削減だけをwire削減や速度向上の測定値にしない。

## 出典

[Q1] Carlo Rovelli, Relational Quantum Mechanics (1996), abstract: https://arxiv.org/abs/quant-ph/9609002

[Q2] Murray Gell-Mann and James B. Hartle, Classical Equations for Quantum Systems (1993), coarse-grained histories and classical predictability: https://arxiv.org/abs/gr-qc/9210010

[Q3] IBM Quantum Learning, Quantum teleportation, protocol resources: https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/quantum-teleportation

[P1] Saṃyutta Nikāya 12.20, Conditions, translation by Bhikkhu Bodhi: https://suttacentral.net/sn12.20/en/bodhi

[P2] David Hume, An Enquiry concerning Human Understanding, section IV: https://davidhume.org/texts/e/4

[C1] Leslie Lamport, Time, Clocks and the Ordering of Events in a Distributed System (1978): https://www.microsoft.com/en-us/research/publication/time-clocks-ordering-events-distributed-system/

[C2] Robert Paige and Robert E. Tarjan, Three Partition Refinement Algorithms (1987): https://epubs.siam.org/doi/10.1137/0216062
