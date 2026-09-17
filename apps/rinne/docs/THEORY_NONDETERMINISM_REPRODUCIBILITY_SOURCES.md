# Nondeterminism / reproducibility loop: source register

This register separates repository observations from established prior art. It does not transfer any paper's theorem to Rinne outside that paper's model.

## Repository sources at start develop

Start source of truth: `6fc205a3e631f4d962a9fbbf43bb2fd273ad92b0`.

- `apps/rinne/src/rebuild/runtime-clock.js`, blob `d8f6c9592c5bded962db350800cd892aa2927e34`: `simulationDelta = min(.05, elapsed)` while `lifeDelta = elapsed`.
- `apps/rinne/src/rebuild/runtime.js`, blob `275f88cd115daebdaf247efe5882ab98e5022013`: new solo life seed uses `Date.now() >>> 0`; frame stepping is driven by `requestAnimationFrame` / `performance.now`; movement/combat receive capped `simulationDelta`; life progression receives uncapped `lifeDelta`.
- `apps/rinne/src/rebuild/domain.js`, blob `90dc1fd32cbabfef20b8e28286b02baccdcea9b8`: solo `life.id` construction uses `Math.random`; birth-village choice from the supplied seed is deterministic.
- `apps/rinne/src/rebuild/coop-world.js`, blob `11a4d1c114e2ffc2a7d3c446cd3c6ce315dcd5ec`: co-op simulation advances explicit `dt <= .05`, current host session calls it with `.05`; players are sorted before stepping; co-op life ids are overwritten as `${playerId}:${generation}`.
- `apps/rinne/src/rebuild/combat-core.js`, blob `793968e360e4d1676f3de72a3b83b3c1f8e2606b`: combat uses seeded Tidebreak sessions but also JavaScript transcendental/norm operations including `Math.sin`, `Math.cos`, `Math.atan2`, and `Math.hypot`.
- `packages/tidebreak-combat/facade.inc.txt`, blob `0c2a1a68e35946c7ec59c66b6bc0714350b5f946`: the embedded combat façade accepts an explicit `step(dt)` and clamps it to at most `1/30`.
- `apps/rinne/src/coop/history.js`, blob `aaba57a8454575646d69aadd48b73127a1972c29`: explicitly states that structural host-attested history is not proof of honest gameplay.

## Deterministic state machines / nondeterminism

- Leslie Lamport, _Stoppable Paxos_ introduction: replicated state machines are deterministic machines executing the same command sequence. https://lamport.azurewebsites.net/pubs/stoppable.pdf
- Leslie Lamport et al., reconfiguration tutorial: formal state-machine model as a function from command-state to output-state. https://lamport.azurewebsites.net/pubs/reconfiguration-tutorial.pdf
- Slember & Narasimhan, _Static Analysis Meets Distributed Fault-Tolerance: Enabling State-Machine Replication with Nondeterminism_, HotDep 2006: SMR requires deterministic application behavior; timers, multithreading and system calls are nondeterminism sources. https://www.usenix.org/legacy/event/hotdep06/tech/prelim_papers/slember/slember_html/
- Castro/Liskov-derived speculative PBFT description notes that a primary may attach nondeterministic data such as current time to a request. https://static.usenix.org/events/nsdi09/tech/full_papers/wester/wester_html/index.html

## Record / replay

- Yang et al., _ORDER: Object CentRic DEterministic Replay for Java_, USENIX ATC 2011: deterministic replay records and reproduces nondeterministic events. https://www.usenix.org/legacy/event/atc11/tech/final_files/Yang.pdf
- Dunlap et al., _ReVirt_, OSDI 2002: replay requires logging enough information to reproduce nondeterministic events. https://www.usenix.org/legacy/event/osdi02/tech/full_papers/dunlap/dunlap_html/index.html

## ECMAScript numerical portability

- ECMAScript specification, `Math.random`: implementation-defined algorithm/strategy. https://tc39.es/ecma262/2025/multipage/numbers-and-dates.html
- ECMAScript specification, `Math.sin`, `Math.cos`, `Math.atan2`, `Math.hypot` and several other functions: implementation-approximated, with latitude in approximation algorithms. Same source as above.
- IEEE 754-2019 specifies deterministic results for operations covered by its normative arithmetic under declared inputs/sequence/formats, but this does not make every host-language transcendental implementation bit-identical. https://standards.ieee.org/ieee/754/6210/

## Robust numerical predicates

- Jonathan Shewchuk, _Adaptive Precision Floating-Point Arithmetic and Fast Robust Predicates for Computational Geometry_, 1997: near-boundary floating-point predicates can return the wrong sign; adaptive precision can resolve only the uncertain cases. https://www.cs.cmu.edu/~quake/robust.html

## Game-network engineering references

These are practitioner references, not formal theorem sources.

- Glenn Fiedler, _Fix Your Timestep!_: variable/semi-fixed frame partition changes simulation behavior; fixed-step accumulator decouples simulation from rendering. https://gafferongames.com/post/fix_your_timestep/
- Glenn Fiedler, _Deterministic Lockstep_: identical inputs are useful only if the simulation is exactly deterministic. https://gafferongames.com/post/deterministic_lockstep/
- Glenn Fiedler, _Floating Point Determinism_: exact cross-platform floating-point replay requires significant restrictions and cannot be assumed from arbitrary floating-point code. https://gafferongames.com/post/floating_point_determinism/
