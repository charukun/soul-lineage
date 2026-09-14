# Parallel Integration Batch

Ready PR の統合待ちを短縮するため、Integration は **前段評価を並列化し、develop への確定書き込みだけを直列化**する。

## 目的

- 独立した Ready PR の expensive preflight（PR/head/review/thread/fast gate/dependency/scope/base comparison）を bounded concurrency で並列評価する。
- 同一 develop baseline 上で安全に共存できる候補を batch として選び、最終 mutable-state gate を再取得した後だけ develop へ連続 merge する。
- develop への merge API 自体は直列のままとし、同時書き込み・force push・品質 gate 緩和を行わない。
- 既存 Virtual Integration Train の GREEN / YELLOW / RED scope 判定と exact-head 証跡を再利用し、RED scope、Depends-On、hold、Changes Requested、未解決 thread、CI/browser failure を跨いで batch 化しない。

## 受入条件

1. Integration Controller は 1 PR ずつ expensive preflight を完了してから次へ進むのではなく、最大6件までの preflight を並列に実行できる。
2. preflight 結果から scope と依存関係が独立した候補だけを merge batch に採用する。
3. merge 直前には各PRの current head、Ready/hold、review/thread、exact-head fast/browser gate と develop SHA を再取得する。
4. merge は develop に対して1件ずつ行い、各merge後に develop SHA を確認する。外部更新を検知したら残りbatchを停止して次runへ返す。
5. batch の途中で先行PRがmergeされた後、後続PRについて同一batchのpreflightだけを盲信せず、先行変更との scope risk と依存関係を再確認する。
6. 既存の max merge、time budget、API reserve、Rescue/repair priority、trusted exact-head authorization、Production保護を維持する。
7. 診断には `parallelPreflight` と batch 選定件数、merge済み件数、deferred/blocked理由を残し、PULSE/Actionsからボトルネックを追跡できるようにする。

この方式は「merge API を同時に6本叩く」ものではない。並列化するのは expensive evaluation と安全なbatch準備であり、develop の正本更新は常に直列である。
