# ECLIPSE — 黎明の残響

Standalone WebGL2 / Three.js auto-battle game. Other applications and their save data are not changed.

Start once, then the knight automatically moves, attacks, casts three skills, chooses upgrades after twelve seconds, and fights five waves including the boss. WASD/arrows or screen dragging overrides movement; keys 1/2/3 and skill buttons allow intervention. Space/Escape pause. Hidden tabs suspend gameplay and Web Audio. No accounts, payments or tracking.

Every character, weapon, floor, wall, pillar, rubble, torch and prop mesh is an original third-party KayKit asset; no original/generated 3D geometry is used. The runtime uses supplied skeletal clips. Composition, lighting, instancing, projected Canvas2D VFX, procedural sound, and game logic are implementation, not 3D model creation. `model-manifest.mjs` records origins, exact revisions, byte sizes and SHA-256 checksums. Build refuses changed or missing models; there is no primitive fallback. Public builds include an expanded manifest and original licenses.

From repository root: `npm ci`, `APP_ENV=dev npm run build --workspace @soul/eclipse`, `node --test apps/eclipse/tests/*.test.mjs`, and `node apps/eclipse/tools/verify-browser.mjs` (requires installed Playwright Chromium). First build retrieves 19.4 MB of pinned CC0 originals. Three.js is pinned to 0.180.0 and bundled locally with Vite. No runtime CDN dependencies.

The `?test=1` option exposes isolated helpers; normal games do not enable them. Verification includes real desktop/mobile WebGL2 rendering, controls, audio pause, and automatic five-wave victory simulation. Physical-device performance is not inferred from software-renderer timing.
