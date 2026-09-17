# Temporal semantics loop: primary-source register

These references prevent established clock, uncertainty and secure-time mechanisms from being renamed as RRP novelty.

## Distributed/physical time

- **T1 — Leslie Lamport, 1978, _Time, Clocks, and the Ordering of Events in a Distributed System_.** Communications of the ACM 21(7), 558–565. Author PDF: https://lamport.azurewebsites.net/pubs/time-clocks.pdf
  - Physical-time specifications require real clocks and explicit synchronization/error assumptions. Logical happened-before remains distinct from physical time.

## Explicit clock uncertainty

- **T2 — James C. Corbett et al., 2012, _Spanner: Google's Globally-Distributed Database_.** OSDI 2012. Google Research: https://research.google/pubs/spanner-googles-globally-distributed-database-2/
  - Spanner's TrueTime API exposes clock uncertainty as an interval rather than pretending a globally exact timestamp. Its external-consistency mechanisms rely on that uncertainty bound and waiting/coordination rules.
  - This branch borrows only the general lesson “represent uncertainty explicitly”; it does not reproduce TrueTime or Spanner.

## Authenticated time synchronization

- **T3 — RFC 8915, _Network Time Security for the Network Time Protocol_, 2020.** https://www.rfc-editor.org/rfc/rfc8915.html
  - NTS authenticates NTP client/server time-synchronization exchanges and identities under its protocol. That establishes properties of time synchronization messages; it is not by itself a proof that an arbitrary game action occurred at a claimed timestamp.

## Scope rule

None of T1–T3 is a new RRP primitive. The residual Rinne-specific problem is to declare which clock domain and observer define each protected temporal predicate, bind deadline-policy generation, represent uncertainty when required, and anchor retries to operation identity.
