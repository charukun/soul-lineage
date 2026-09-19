# ASHEN VIGIL — 灰燼の誓い

An independent Three.js/WebGL2 automatic battle game. Public worker: https://ashen-vigil.c-okamoto.workers.dev/ (only considered live after the public browser test passes).

## Play

Start a pilgrimage. Three autonomous heroes fight through six nights, ending with the Drowned Admiral. Choose one of three boons between waves; an eight-second automatic selection also allows fully unattended play. Tap the terrain to rally the party. The Prayer Bell heals and strikes nearby enemies; it has a cooldown. Pause, 1x/2x, optional synthesized audio, defeat, victory, and a clean retry are implemented. The best run is stored locally. No login, billing or server-side personal information.

## 3D provenance / prohibited reuse

All world objects, actors, weapons and animations are downloaded, human-authored upstream glTF models. No assistant-authored 3D models, no primitive stand-ins, no generated replacement models. The ground uses instanced original Kenney road mesh data; geometry/UV/index buffers remain unchanged. Visual effects are screen-space Canvas2D projections, not substitute 3D models. Lighting, placement, scale and material rendering parameters are art-directed in code.

New packs:
- Quaternius, Pirate Kit, CC0: https://quaternius.com/packs/piratekit.html . Pinned download mirror: agentkaerf/FreeModels at db3df04d1e4714298a09510b26fb6de6645138a2.
- Kenney, Graveyard Kit 5.0, CC0: https://kenney.nl/assets/graveyard-kit . Original versioned author download.

Excluded entire packs: KayKit Adventurers, KayKit Skeletons, KayKit Dungeon Remastered, KayKit Medieval Hexagon, Kenney Nature Kit. These cover the inspected existing games and Nocturne's acquisition script. Each newly downloaded model is compared by SHA-256 against the repository's tracked prior 3D files. The audit describes exactly the checked scope; it is not a claim to have scanned inaccessible historical files. Original bytes, source URLs, animation names and SHA-256 appear in `/assets-manifest.json`. Existing app files, models, save data and workers are unchanged.

## Build and evidence

From a repository checkout:
```
python3 apps/ashen-vigil/prepare.py
cd apps/ashen-vigil
npm install --workspaces=false
npx playwright install chromium
npm run build
npm test
```

`game.test.mjs` tests deterministic combat, no-input progress, pause, cooldown, boons and clean restart. `smoke.mjs` runs real Chromium/WebGL on desktop, portrait mobile and landscape: asset load, title, autonomous combat, actual animation availability, pause/resume, speed, bell, responsive controls, boon selection and browser errors. Run `node smoke.mjs https://ashen-vigil.c-okamoto.workers.dev/` for anonymous public verification. Evidence includes screenshots and JSON reports; `/build.json` records the exact source SHA.

Rendering and automated device-size testing do not replace performance measurements on a physical Pixel Fold. No unmeasured mobile FPS guarantee is made.

A dedicated GitHub Actions workflow builds and tests this app and deploys an isolated Cloudflare static-assets Worker with existing authorized repository secrets. No changes to main, existing Production apps or review gates.
