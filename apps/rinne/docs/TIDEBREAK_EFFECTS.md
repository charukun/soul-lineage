# Tidebreak authored combat effects

## Scope and integration

PR #739 adds presentation only to Rinne's existing renderer and confirmed combat
event stream. Tidebreak PR #728 is already merged into `develop`. This PR does not
edit `combat.js`, input, damage, stamina, character motion, saves, the network
protocol, main, or Production.

`runtime.js` forwards solo/co-op events to `combat-effects-renderer.js`.
`combat-effects-stage.js` draws inside the existing Three scene pass, before its
focus/composite pass. It creates neither a second canvas nor a postprocessing
pipeline. Native GL state restoration stays enabled; no framebuffer reset occurs
inside the scene callback. The bootstrap is deferred outside Three's render stack.

## Imported originals, not generated approximations

| Role | Unmodified authored source | Author/license |
| --- | --- | --- |
| Contact-time slash | `samples/00_Basic/Simple_Ribbon_Sword.efkefc` | Effekseer / CC0-1.0 |
| Normal impact | `samples/02_Tktk03/ToonHit.efkefc` | tktk / CC0-1.0 |
| Heavy / finisher burst | `samples/02_Tktk03/Light.efkefc` | tktk / CC0-1.0 |
| Playback | EffekseerForWebGL `docs/effekseer.js` + `docs/effekseer.wasm`, v1.70 | Effekseer / MIT |

The canonical source list is `../src/rebuild/authored-effect-manifest.js`.
ResourceData revision: `1adef35d78363d3e914192267adf83a8e2b30759`.
Runtime revision: `e8c3ce076644789918695b0cba0031461c817890`.
Sample license: Effekseer `216c307192ff9bc7917472b05731bbc4fd46fa04`,
`docs/readme_sample.txt`. The 25 required original/runtime/license files have exact
byte counts and Git blob hashes. No unused pack or FBX import is needed.

`node scripts/prepare-rinne-effects.mjs` acquires only these pins, verifies bytes
before atomic installation, checks EFKE INFO dependency closure, and writes notices
under `apps/rinne/public/simulator/assets/effekseer/`. Rinne predev/prebuild run it.
A verified cache works offline. A cold cache tries two fixed-revision hosts; both
failing or any unresolved integrity/closure error fails preparation rather than
claiming a successful asset import. Generated downloads are not committed.
Production browser playback uses same-origin installed assets, not CDN hotlinks.
No new paid service or npm dependency is introduced.

## Event contract and limits

Only confirmed positive finite damage creates a cue. `player-hit` targets the
named enemy; `enemy-hit` targets the player. Unknown entities, zero damage,
evasion and guard events never invent an impact. `one-motion` paired with
`player-hit` for the same target is presented once. `kyu` and manual/`one` contacts
use the dedicated authored `Light` finisher while normal contacts use `ToonHit`.

Effects are anchored at victim and actor/target midpoint at the confirmed event.
The source ribbon retains its authored swing. This is contact-time presentation,
not a claim of blade-tip bone attachment or a new pre-hit animation event: #728
has no such presentation contract. No cooldown/pose guess changes hit timing.
Source scale, placement and finisher multiplier are reversible presentation tuning
and still require actual DEV visual comparison; they are not upstream defaults.

Co-op replay identity uses world/epoch/tick, independent of historyRevision. Life,
zone, interior and front-stage transitions clear handles and replay scope. Resource
loading never queues old hits to replay later. Hidden/ended scenes and runtime exit
stop playback, including when a prepared host is retained for reuse.

Mobile active limits by quality tier: 4/3/2/1; desktop: 6/4/2/1. A batch starts at
most four handles. Finishers and impacts take priority over trails. Reduced motion
keeps one smaller impact/finisher with no slash. Native allocation limits are 512
instances and 512 squares; these are limits, not measured draw calls or a zero-cost
claim. Handles also have finite lifetimes and are released on native completion.

Optional runtime/script/image failure disables VFX without stopping gameplay.
Resource callbacks are owned and cancelled before native context release. No late
callback can revive a disposed view. WebGL context loss disables this optional
backend for the current view instead of retrying indefinitely.

## Validation and evidence

Focused validation:

```sh
node --test apps/rinne/tests/authored-combat-effects.test.mjs apps/rinne/tests/authored-effect-assets.test.mjs apps/rinne/tests/effekseer-loader.test.mjs apps/rinne/tests/authored-effect-wiring.test.mjs
```

The hermetic Node suite covers event mapping, actual-hit-only behavior, the
dedicated finisher route, paired-event and co-op deduplication, budgets, priority,
lifetime, pause/scene cleanup, renderer callback ownership, asset pins/closure/
corruption/fallback, native callback cancellation and partial initialization
failure. SDK/GPU/DOM in these tests are controlled doubles, not evidence of actual
visual playback or performance.

This execution environment has no repository checkout/dependencies and its
ordinary network route fails DNS resolution. Full Vite build, complete real asset
acquisition, actual native WebGL playback, original-versus-game video and Pixel
Fold frame-time evidence are not obtained here. No screenshot/video is presented
as verified. Integration owns build/DEV publication without weakening existing
checks. On DEV inspect contact timing, depth occlusion, ToonHit/Light materials,
effect scale/decay, replay suppression and mobile load. A normal Ready handoff
does not mean integrated, DEV deployed, or visually certified.
