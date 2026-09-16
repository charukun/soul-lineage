# RRP theory verification loop

Start develop: `25fffb0275e3d57f21aa6d37077a6a4124e6b76e`

This loop remains model/theory work. Physical capture is not treated as a substitute for unresolved protocol proof.

Acceptance before handoff:

- model the Canon commit packet interleavings rather than assuming an acknowledged replica appears atomically;
- exhaust crash timing around store/ack/visible-commit/recovery and prove visible Canon never loses its recovery-complete evidence;
- generalize crash-quorum rules beyond the fixed 3-node/f=1 case and retain the 2-peer no-witness impossibility boundary;
- add burst-loss and duplicate/reorder delivery to the deterministic protocol model without claiming real SCTP/NAT/TURN certification;
- replace the dense-room fixed-Cell dead end with an adaptive relay fan-out candidate and prove its fan-out/extra-hop/failure trade-off instead of assuming it always wins;
- compose the new commit, failure and relay models with Semantic Frontier requirements and keep known impossibility/lower-bound cases as explicit rejections;
- reject any claim that is only true because unsafe visibility, unavailable quorum, or missing failure cases were omitted;
- keep runtime/Production unchanged in this task; implementation target is Reality Lab proof code, tests and architecture documentation only.
