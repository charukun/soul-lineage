# ECLIPSE / 黎明の残響

Independent Three.js r180 / WebGL2 auto-battle game. This directory does not alter the four existing games or their saves. The isolated Cloudflare development worker is `soul-lineage-eclipse-dev`.

## Play

Choose 「禁域へ」. Movement, attacks and three skills run automatically. Drag the battlefield or use WASD / arrow keys to intervene. Keys 1/2/3 trigger available skills. Pause also suspends audio; hidden tabs cannot keep fighting. Between five waves choose a blessing, or allow automatic selection. The final wave features the dragon boss.

## Strict asset policy

Every rendered 3D mesh is an artist-authored Quaternius download under CC0. No custom, procedural, AI-generated, substitute or fallback 3D mesh is allowed. Original glTF and binary buffers are copied byte-for-byte. Scene placement, transforms, skeletal animations, lighting and 2D particle sprites are game code, not new 3D models.

The current set consists of 22 freshly acquired assets from six packs, including the detailed Female Ranger, Universal Animation Library 2, Cute Animated Monsters (August 2020), Medieval Village MegaKit, Fantasy Props MegaKit and Stylized Nature MegaKit. The animation library is used for clips only: its mannequin mesh is never added to the scene.

The four excluded games are 輪廻転生, 尽喰廻遊, 村アプリ and ノクターン. Their model inventories and source references were audited at pinned develop and Nocturne snapshots. Their KayKit/Kenney assets and Quaternius Ultimate Monsters (Beholder/Chomper/Glub/Goleling) are not permitted, including differently packaged glTF/GLB versions of those models.

`model-manifest.mjs` pins the source repository and revision. `tools/acquire.mjs` verifies original Git blob hashes and publishes SHA-256 checksums, source links and the exclusion report. Runtime tests verify that every rendered mesh uses a downloaded original geometry. Provenance is also linked from in-game credits.

## Build and verification

From the repository root:

```sh
npm ci
node --test apps/eclipse/tests/*.test.mjs
npm run build --workspace @soul/eclipse
npx playwright install chromium
node apps/eclipse/tools/verify-browser.mjs
```

A previously acquired source cache can be supplied via `ECLIPSE_SOURCE_CACHE`. Missing files are downloaded from the pinned revision and individually verified. Acquisition never fabricates a missing model.

The isolated workflow validates its exact commit, checks real skeletal animation, runs desktop and 390px touch browser playtests, exercises all five waves to victory, deploys only Eclipse, and repeats the tests against the public unauthenticated URL. Screenshots and local checks are inspectable at `/evidence/`; CI preserves the additional public verification report. Software-rendered CI timing is not a real-device FPS benchmark. No physical-phone performance claim is made.
