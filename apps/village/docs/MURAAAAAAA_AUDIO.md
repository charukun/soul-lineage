# MURAAAAAAA audio handoff

Soundtrack collection: `三界の調べ` (`rinne-three-worlds-150-v2`).

Runtime playback/UI uses the repository-wide `@soul/shared-ui/music` adapter. MURAAAAAAA starts `v01` on the first user interaction in DEV and then exposes the shared 150-track music room. Do not add a second app-local `<audio>` player because that would allow duplicate playback.

Expected village set: `v01`..`v48`. Shared tracks remain available from the music room.
Expected deploy root: `audio/three-worlds-150/`.
Preferred format: Ogg.

The repository already contains the shared audio catalog/runtime integration. Production/public release remains blocked while the catalog's rights metadata says audition/review required and `commercialClearance: false`.
