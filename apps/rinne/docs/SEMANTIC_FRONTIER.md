# RRP Semantic Frontier

## 目的

Canon Nucleus の次段階として、「単一の新プロトコルを既知方式より速くする」比較から、「要件・障害・信頼境界ごとに既知方式そのものを選択肢として包含し、その Pareto 包絡を作る」比較へ進める。

ここでいう `Semantic Frontier` は一つの固定 wire protocol ではない。操作の意味、必要な安全性、ネットワーク条件、利用可能な authority / replica / external service を宣言し、適用可能な policy の組合せから安全な計画だけを列挙するメタ・アーキテクチャである。

「すべてを超える」を、物理的に不可能な「全条件で全方式より厳密に小さい遅延・通信量・CPU・接続数を同時達成する」という意味にはしない。CAP、FLP、crash/BFT replica 下限、既に理論下限へ到達した単一方式の存在を保存する。最大到達点は次の2条件で定義する。

1. **Policy closure**: 比較対象の既知 family の全 feasible Pareto point を同じ cost / safety 条件で再現できる。したがって frontier はそれらを弱く包含し、baseline より悪い点しか選べない状態を作らない。
2. **Strict frontier expansion**: 各 family について、その family 単独では満たせず Semantic Frontier なら満たせる正当な workload/fault envelope が少なくとも1つ存在する。混合 workload では切替え overhead を含めても既知の単一全状態方式を厳密に Pareto 支配する例が存在する。

この定義なら、既に最適な一点は「同値で再現」し、異質な workload では「組合せで拡張」できる。これ以上の universal strict dominance は下限・不可能性結果と矛盾するため要求しない。

## 比較 family

`semantic-frontier.js` は現在、次の family を同じ planner へ入れる。

- authoritative snapshot / client prediction 型
- dedicated authoritative 型
- deterministic lockstep
- rollback netcode
- approximate state synchronization
- Raft 型 crash-consensus replicated log
- Paxos 型 crash consensus（この模型では Raft と同じ crash-quorum cost class に畳み、アルゴリズム実装が同一とは扱わない）
- RedBlue consistency
- CRDT
- gossip / eventual dissemination
- peer full-mesh quorum
- PBFT 型 Byzantine replication
- external strong ordering / durable transaction service
- Canon Nucleus

これとは別に既存 Reality Lab の `global / Interest / Cell` を spatial fan-out 軸として維持する。Semantic Frontier の consistency/authority 軸と、Reality Lab の presence distribution 軸を同じ `reality-architecture-proof.mjs` で合成して確認する。

## 操作意味論

操作は少なくとも以下へ分類する。

- `presence`: 新しい値が古い値を置換できる位置・向き・演技状態。
- `authoritative`: Host/Server が確定するが、永続正史ではない戦闘・世界状態。
- `mergeable / causal`: 可換性または因果制約が証明された弱整合操作。
- `canon`: 出生・死亡・転生・血統など不可逆で crash survival が必要な履歴。
- `adversarial-canon`: 改造 authority を信頼できず Byzantine safety が必要な履歴。
- `external-txn`: ゲーム端末の外にある外部順序・durability が契約となる操作。

各操作は `total order / crash survival / Byzantine / external order / partition availability / guaranteed termination / rollback allowed / latency budget` を明示する。

### Invariant closure

意味論を分けるだけでは安全ではない。たとえば `credit` を CRDT、`spend` を Canon に分けても、両方が同じ `balance` invariant を触るなら独立に処理できない。

そこで、共通 invariant を持ち、相互可換性が明示的に証明されていない操作群には、必要な強い要件を閉包として伝播する。不可逆操作と invariant を共有する mergeable 操作は total-order / crash-survival 側へ昇格し、rollback を禁止する。

相互 `commutesWith` が明示された操作だけは弱整合のまま残せる。policy 切替え時にも shared invariant があれば通常の切替え overhead より重い reconcile / fence / ordered-handoff barrier を加算する。

## Feasibility gate

planner は「その policy が安いか」を比較する前に required guarantee を満たすかを検査する。

- total order を要求する操作を state-sync / CRDT へ落とさない。
- crash survival を要求する操作を単一 authority へ落とさない。
- Byzantine safety を要求する操作を Raft / Canon Nucleus へ落とさない。
- external order を要求する操作を local consensus で代用しない。
- partition availability を要求する操作を quorum policy へ落とさない。
- latency budget を越える policy は infeasible にする。

不足した resource は性能劣化として採点せず `infeasible` とする。

## 最大 frontier の証明

### 1. Closure

各 family `F_i` の policy set は frontier policy set `P` の部分集合として登録される。同じ workload、同じ環境、同じ policy-switch overhead を使うため、`F_i` が生成できる plan は `P` でも同じ plan として生成できる。

したがって、`P` の Pareto frontier は各 baseline Pareto point を、同値で含むか、別の frontier point で厳密に支配する。代表1点だけではなく family ごとの全 Pareto point を検査する。

### 2. 非空性

「baseline が一度も feasible でないので vacuous に covered」という偽証明を防ぐため、全 family に個別の reachability witness を持つ。現在14 familyすべてで baseline Pareto set が非空になる条件を検証する。

### 3. Strict extension

全14 familyについて、その family 単独では infeasible だが frontier では feasible となる witness を持つ。

例:

- snapshot / dedicated / lockstep / Raft / Paxos / mesh に対して partition-available mergeable operation を CRDT で継続する。
- rollback / state-sync / CRDT / gossip に対して crash-safe Canon を Canon Nucleus / crash consensus で継続する。
- RedBlue / Canon Nucleus に対して adversarial Canon を PBFT policy へ上げる。
- PBFT に対して external-order transaction を external strong policy へ渡す。
- external-strong 単独に対して、外部 order を要求しない Byzantine Canon を PBFT へ渡す。

これは「各 baseline の得意点より必ず速い」という主張ではなく、「各 baseline の feasible region を真に包含する」という strict extension である。

### 4. 混合 workload の strict cost gain

百年転生型 workloadでは presence / combat / mergeable state / irreversible Canon が同時に存在する。全状態を crash-consensus log や full-mesh quorumへ入れる方式に対し、replaceable `R` を strong path から外し Canon/recovery `C` のみを strong commit するため、同じ f=1 crash safety 下で strong-path 通信は `R + C` から `C` へ減る。

切替え overhead と invariant barrier を加えた上でも、現在の model では Raft-all-state と full-mesh-quorum の baseline Pareto pointを strict に支配する witness が残る。

### 5. Universal strict dominance は false

単一の mergeable operation だけなら、CRDT baseline が既に frontier 上の最適点になり、Semantic Frontier はそれを同値で再現する。crash f=1 Canon の必要copy数など理論下限へ到達した点でも同様に、厳密にそれ未満へは行けない。

よって証明する命題は:

```text
universal strict dominance = false
policy-set weak closure = true
strict feasible-region expansion = true
mixed-workload strict improvement exists = true
impossibility/lower-bound preservation = true
```

これを `Maximal Frontier` と呼ぶ。既知方式を固定方式として一つずつ倒すのではなく、その方式を frontier の内点として取り込み、得意点では同値、混合条件では composition によって外側へ広げる。

## 不可能性境界

### CAP

partition 中にも availability を必須とする操作へ、同時に strong/global order を要求した場合は plan を生成しない。Gilbert/Lynch の CAP proof が示す不可能条件を「通信方式の勝敗」として誤魔化さない。

- https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.pdf

### FLP

fully asynchronous model で crash failure を許し、deterministic consensus に guaranteed termination まで要求する場合は plan を生成しない。FLP の nontermination possibility を timeout の短縮で消えたことにしない。

- https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf

### Crash consensus

Raft/Paxos は crash-consensus family の代表として扱う。Raft の majority availability / safety と Paxos の consensus foundationを、ゲーム全状態を必ず strong logへ入れる理由にはしない。

- https://raft.github.io/
- https://lamport.azurewebsites.net/pubs/paxos-simple.pdf

### Byzantine

PBFT-style modelは f Byzantine faults に対して `3f+1` replica 条件を保存する。f=1なら4 replica。これはこの BFT model の safety/liveness 条件であり、Canon Nucleus の non-Byzantine 3-node条件と混同しない。

- https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance

### Strong external order

外部 durable/global order が要求された workload は local peer consensus で代用しない。模型の `external-strong` は Spanner そのものの再実装ではなく、外部に強い ordering/durability service が存在する policy class を表す。

- https://research.google/pubs/spanner-googles-globally-distributed-database-2/

## 既知の弱整合・game netcodeとの位置関係

RedBlue Consistencyは、操作を fast/eventual な blue と strong な red に分ける一般原理を既に示している。Semantic Frontier の意味論分離自体を新しい一般 consistency class とは呼ばない。追加点は、ゲームの rollback/presence、crash-safe Canon、Byzantine/external requirements、spatial fan-outを同じ safety gate / Pareto plannerへ入れ、invariant closureとrecovery boundaryを明示すること。

- https://www.usenix.org/conference/osdi12/technical-sessions/presentation/li

CRDT / gossip family は merge可能な操作だけに使う。mergeabilityを宣言しただけで共有 invariant が安全になるとは扱わない。

- https://crdt.tech/papers.html

Rollback は deterministic simulation と予測/再実行が成立する realtime 領域の有力policyだが、確定した人生履歴へ適用しない。

- https://www.ggpo.net/

ゲーム側の snapshot / prediction / interpolation、deterministic lockstep、state synchronization は既知の基準として残す。Source型 client/server は snapshot・prediction・interpolation・lag compensationを組み合わせ、Gafferの比較は lockstep / snapshot interpolation / state synchronization の異なる trade-off を示す。

- https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
- https://gafferongames.com/categories/networked-physics/

WebRTC transport自体も reliable/unreliable、ordered/unordered、partially reliableをサポートするため、Semantic Frontier の presence / critical control 分離はtransport contractと矛盾しない。

- https://www.rfc-editor.org/rfc/rfc8831.html

## 検証実装

focused proof:

```sh
node --test apps/rinne/tests/reality-semantic-frontier.test.mjs
```

combined architecture proof:

```sh
node apps/rinne/scripts/reality-architecture-proof.mjs
```

現在の deterministic semantic sweep は以下を掛け合わせる。

- players: 4 / 30
- RTT: 20 / 80 / 220 ms
- deterministic engine: false / true
- crash replicas: 0 / 3
- Byzantine replicas: 0 / 4
- trusted authority: false / true
- external service: false / true
- partition: false / true
- workload class: presence / deterministic combat / AP merge / crash Canon / Rinne mixed / adversarial Canon / external transaction

合計2688 case。全caseで「登録baselineの feasible Pareto point が frontier closure から消えない」ことを検査する。現在のmodel resultは 2688/2688 covered、1120 caseで少なくとも1 familyへのstrict Pareto improvement、600 caseは要求とresourceの組合せ自体が infeasible と判定される。infeasible を敗北/成功のどちらにも偽装しない。

全14 familyは別のreachability testで少なくとも1回 feasible になることを確認し、さらに全14 familyにstrict capability-extension witnessを持つ。

既存 Reality Lab 9-case matrixも同じ combined proofから実行し、spreadでのCell benefit、denseでCellが勝てないcounterexample、Host recovery、corruption repairを引き続き保持する。

## 証拠の強さ

このproofのうち、次は構造証明であり model cost係数に依存しない。

- CAP / FLP infeasible boundaryを通過不能にすること。
- required guaranteeを満たさないpolicyを選べないこと。
- family policy setを包含するためbaseline planを再現できること。
- invariant conflictをstrong sideへ閉包すること。
- 全familyにfeasible witnessとstrict capability-extension witnessがあること。
- universal strict dominanceを主張しないこと。

一方、wireBytes / latency / CPU の具体的な数値、どのPareto pointが実端末で選ばれるかは模型。実装係数の正しさは実WebRTC / 実機測定が必要。

## 未証明

- NAT/TURN/carrier経路と実際のSCTP再送・congestion behavior。
- burst loss、radio sleep、background suspendの実機分布。
- 30実端末とPixel Fold級端末のCPU/RAM/電池。
- Sybil、共謀、改造client、key compromiseまで含むByzantine identity/security。
- 任意の新しい未知algorithmを、catalogへ追加する前から性能まで上回ること。
- policy間の任意state変換。共有invariant/commutativityで宣言した範囲だけを証明する。

未知の新方式が現れた場合は、その guarantee / feasibility / cost policyを候補集合へ追加する。closure theoremにより追加後のbaseline planはそのままfrontierに含まれるが、その新方式を上回るstrict witnessは改めて検証する。
