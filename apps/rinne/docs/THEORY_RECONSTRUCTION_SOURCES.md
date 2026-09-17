# RRP reconstruction: primary-source register

Companion to [the matched baseline analysis](THEORY_RECONSTRUCTION_BASELINES.md). Keys are also used in the [contract](THEORY_RECONSTRUCTION_CONTRACT.md).

## Primary-source register

These links identify the work behind the comparisons, not a claim that each implementation was reproduced or every proof mechanically checked.

- C1 — Ongaro/Ousterhout, *In Search of an Understandable Consensus Algorithm*, extended version (2014): https://raft.github.io/raft.pdf
- C2 — Lamport, *Paxos Made Simple* (2001): https://www.microsoft.com/en-us/research/publication/paxos-made-simple/
- C3 — Moraru/Andersen/Kaminsky, *There Is More Consensus in Egalitarian Parliaments* (2013): https://www.cs.cmu.edu/~dga/papers/epaxos-sosp2013.pdf
- C3b — Ryabinin/Gotsman/Sutra, *Making Democracy Work: Fixing and Simplifying Egalitarian Paxos*, extended version v2 (2026): https://arxiv.org/html/2511.02743v2
- C4 — Howard/Malkhi/Spiegelman, *Flexible Paxos: Quorum intersection revisited* (2016): https://arxiv.org/abs/1608.06696
- C5 — Lamport, *Fast Paxos* (2006): https://www.microsoft.com/en-us/research/publication/fast-paxos/
- C6 — van Renesse/Schneider, *Chain Replication for Supporting High Throughput and Availability* (2004): https://www.cs.cornell.edu/fbs/publications/ChainReplicOSDI.pdf
- C7 — Liskov/Cowling, *Viewstamped Replication Revisited* (2012), MIT record: https://dspace.mit.edu/handle/1721.1/71763
- C8 — Castro/Liskov, *Practical Byzantine Fault Tolerance* (1999): https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance
- C9 — Yin et al., *HotStuff: BFT Consensus in the Lens of Blockchain*: https://arxiv.org/abs/1803.05069
- W1 — DeCandia et al., *Dynamo: Amazon's Highly Available Key-value Store* (2007): https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store
- W2 — Preguica, *Conflict-free Replicated Data Types: An Overview* (research-author survey): https://arxiv.org/abs/1805.06358
- W3 — Li et al., *Making Geo-Replicated Systems Fast as Possible, Consistent as Necessary* (2012): https://www.usenix.org/conference/osdi12/technical-sessions/presentation/li
- W4 — Lloyd et al., *Don't Settle for Eventual: Scalable Causal Consistency for Wide-Area Storage with COPS* (2011): https://www.cs.cmu.edu/~dga/papers/cops-sosp2011.pdf
- W5 — Demers et al., *Epidemic Algorithms for Replicated Database Maintenance* (1987): https://www.cis.upenn.edu/~bcpierce/courses/dd/papers/demers-epidemic.pdf
- W6 — Bailis et al., *Highly Available Transactions: Virtues and Limitations*: https://arxiv.org/abs/1302.0309
- I1 — Bailis et al., *Coordination Avoidance in Database Systems*: https://arxiv.org/abs/1402.2237
- I2 — Hellerstein/Alvaro, *Keeping CALM: When Distributed Consistency is Easy*: https://arxiv.org/abs/1901.01930
- G1 — Fiedler, *Deterministic Lockstep* (author's implementation exposition): https://gafferongames.com/post/deterministic_lockstep/
- G2 — GGPO official project: https://www.ggpo.net/
- G3 — Fiedler, *Snapshot Interpolation*: https://gafferongames.com/post/snapshot_interpolation/
- G4 — Fiedler, *State Synchronization*: https://gafferongames.com/post/state_synchronization/
- G5 — Mirror official authority documentation: https://mirror-networking.gitbook.io/docs/manual/guides/authority
- N1 — IETF RFC 7667, *RTP Topologies*: https://www.rfc-editor.org/rfc/rfc7667.html
- N2 — IETF RFC 4601, *Protocol Independent Multicast - Sparse Mode*: https://www.rfc-editor.org/rfc/rfc4601.html
- S1 — Marzolla/D'Angelo, *Parallel Data Distribution Management on Shared-Memory Multiprocessors*, TOMACS: https://arxiv.org/abs/1911.03456
- S2 — Jefferson/Sowizral, *Fast Concurrent Simulation Using the Time Warp Mechanism: Part I, Local Control* (1982): https://www.rand.org/pubs/notes/N1906.html
- S3 — Jefferson et al., *Time Warp Operating System* (1987): https://doi.org/10.1145/41457.37508
- L1 — Fischer/Lynch/Paterson, *Impossibility of Distributed Consensus with One Faulty Process* (1985): https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf
- L2 — Gilbert/Lynch, *Perspectives on the CAP Theorem* (authors' later treatment, not the original 2002 paper): https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer2.pdf
- L3 — Lamport, *Time, Clocks, and the Ordering of Events in a Distributed System* (1978): https://lamport.azurewebsites.net/pubs/time-clocks.pdf

CAP here constrains atomic consistency plus availability through partitions under its model. FLP constrains deterministic termination in a fully asynchronous crash model; neither result prohibits all useful distributed games, randomized techniques or practical partially synchronous consensus.
