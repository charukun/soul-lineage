# RRP authority membership rotation

This note covers one remaining Canon Nucleus theory boundary: mobile/browser authority members can become backgrounded, suspended or otherwise unsuitable while the room continues.

The rule is conservative: a suspended authority is treated as unavailable for **new Canon**. Realtime presence may continue under its own policy, but the Canon authority set cannot silently pretend a sleeping member is a durable quorum participant.

## Direct switch is unsafe

For default `f=1`, old membership `{A,B,C}` and replacement membership `{A,B,D}` each use majority `2`.

A direct config flip without a bridging Canon record admits disjoint majorities:

```text
old majority: {A,C}
new majority: {B,D}
intersection: {}
```

If each side can independently believe its configuration is active, majority intersection no longer protects one history. The proof retains this as a required counterexample.

## One-member bridge rule

For crash budget `f`, both old and new authority sets have `2f+1` members with quorum `f+1`. Replacing exactly one member leaves `2f` common members, enough to choose a common `f+1` bridge quorum.

That bridge quorum is itself a majority of both configurations. Therefore it intersects every old majority and every new majority. The configuration change is serialized through that common majority before the new configuration becomes active.

The deterministic proof enumerates this property for `f=1..4`, including every bridge majority against every old and new majority.

A product transition follows the stronger rule:

1. old configuration still has an available majority;
2. write the configuration transition and current recovery-complete Canon through an old/new common-majority bridge;
3. copy current recovery material to the incoming member;
4. fence the removed/suspended member from future epochs;
5. only then consider the new authority membership ready for new Canon.

If the old majority is already lost, membership rotation does not manufacture a replacement authority. Canon fails closed.

## Background/suspension case

With `{A,B,C}` and `C` suspended, `{A,B}` still forms the old majority. It can bridge to `{A,B,D}` and provision `D` before the new membership is considered ready.

If two old members are already unavailable, only one old member remains. That is below the old majority, so the peer-only model cannot safely decide which history/configuration is authoritative. Rotation is blocked.

This means browser visibility/background signals are eligibility inputs, not consensus evidence. Real browsers may suspend without timely notification, so the physical runtime still needs conservative lease/health handling. This model proves what the membership transition must require once a member is classified unavailable; it does not prove that mobile suspension is detected on time.

## Replacing more than one member

For a 3-member nucleus, changing `{A,B,C}` directly to `{A,D,E}` leaves only one common member, below quorum 2. The common-majority bridge proof no longer applies.

Use one of:

- sequential one-member replacements, each committed through a common-majority bridge; or
- a full joint-consensus membership protocol whose joint phase explicitly requires the old and new configuration quorums.

The current RRP proof only certifies the sequential one-member rule. It does not silently generalize that result to arbitrary bulk membership changes.

## Reproducible proof

```sh
node --test apps/rinne/tests/reality-theory-verification.test.mjs
node apps/rinne/scripts/reality-architecture-proof.mjs
```

The combined architecture proof also keeps the two-peer no-witness boundary: membership rotation requires an old quorum; it is not a workaround for split-brain-safe availability with only two peers under arbitrary partition.
