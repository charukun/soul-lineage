const ALL_APPS = Object.freeze(['rinne', 'village', 'demon']);
const asset = value => Object.freeze({ ...value, apps: ALL_APPS });
const source = value => Object.freeze(value);

const KENNEY_MIRROR = 'shorepine/kenney';
const KENNEY_COMMIT = '3694c6879e487c108f55677be7dd2ca75b07cc3b';

export const PUBLIC_WEB_PHASE4_SOURCES = Object.freeze({
  'kenney-mini-forest': source({
    provider: 'Kenney',
    license: 'CC0-1.0',
    canonicalUrl: 'https://kenney.nl/assets/mini-forest',
    mirrorRepository: KENNEY_MIRROR,
    mirrorCommit: KENNEY_COMMIT,
    repositoryRoot: 'assets/vendor/public-web/kenney-mini-forest',
    manifest: 'assets/vendor/public-web/kenney-mini-forest/MANIFEST.json',
    redistributionAllowed: true,
  }),
  'kenney-foliage-sprites': source({
    provider: 'Kenney',
    license: 'CC0-1.0',
    canonicalUrl: 'https://kenney.nl/assets/foliage-sprites',
    mirrorRepository: KENNEY_MIRROR,
    mirrorCommit: KENNEY_COMMIT,
    repositoryRoot: 'assets/vendor/public-web/kenney-foliage-sprites',
    manifest: 'assets/vendor/public-web/kenney-foliage-sprites/MANIFEST.json',
    redistributionAllowed: true,
  }),
  'kenney-smoke-particles': source({
    provider: 'Kenney',
    license: 'CC0-1.0',
    canonicalUrl: 'https://kenney.nl/assets/smoke-particles',
    mirrorRepository: KENNEY_MIRROR,
    mirrorCommit: KENNEY_COMMIT,
    repositoryRoot: 'assets/vendor/public-web/kenney-smoke-particles',
    manifest: 'assets/vendor/public-web/kenney-smoke-particles/MANIFEST.json',
    redistributionAllowed: true,
  }),
  'kenney-light-masks-phase4': source({
    provider: 'Kenney',
    license: 'CC0-1.0',
    canonicalUrl: 'https://kenney.nl/assets/light-masks',
    mirrorRepository: KENNEY_MIRROR,
    mirrorCommit: KENNEY_COMMIT,
    repositoryRoot: 'assets/vendor/public-web/kenney-light-masks-phase4',
    manifest: 'assets/vendor/public-web/kenney-light-masks-phase4/MANIFEST.json',
    redistributionAllowed: true,
  }),
  'polyhaven-wood-planks': source({
    provider: 'Poly Haven',
    license: 'CC0-1.0',
    canonicalUrl: 'https://polyhaven.com/a/wood_planks',
    apiRepository: 'Poly-Haven/Public-API',
    repositoryRoot: 'assets/vendor/public-web/polyhaven-wood-planks',
    manifest: 'assets/vendor/public-web/polyhaven-wood-planks/MANIFEST.json',
    redistributionAllowed: true,
  }),
});

const materialized = (sourceId, category, localPath, tags) => asset({
  sourceId,
  category,
  status: 'MATERIALIZED',
  localPath,
  tags,
});

export const publicWebPhase4AssetCatalog = Object.freeze({
  'model.forest.bridge': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/bridge.glb', ['forest', 'bridge', 'wood', 'crossing']),
  'model.forest.fence': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/fence.glb', ['forest', 'fence', 'wood', 'boundary']),
  'model.forest.ladder': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/ladder.glb', ['forest', 'ladder', 'wood', 'prop']),
  'model.forest.patch-grass': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/patch-grass.glb', ['forest', 'grass', 'ground', 'dressing']),
  'model.forest.plant': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/plant.glb', ['forest', 'plant', 'vegetation', 'dressing']),
  'model.forest.rocks-high': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/rocks-high.glb', ['forest', 'rock', 'terrain', 'dressing']),
  'model.forest.stones': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/stones.glb', ['forest', 'stone', 'terrain', 'dressing']),
  'model.forest.tent': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/tent.glb', ['forest', 'camp', 'tent', 'survival']),
  'model.forest.tree': materialized('kenney-mini-forest', '3d', 'assets/vendor/public-web/kenney-mini-forest/models/tree.glb', ['forest', 'tree', 'vegetation', 'canopy']),

  'sprite.foliage.flat-01': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/flat/sprite_0001.png', ['foliage', 'billboard', 'vegetation', 'flat']),
  'sprite.foliage.flat-02': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/flat/sprite_0002.png', ['foliage', 'billboard', 'vegetation', 'flat']),
  'sprite.foliage.flat-03': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/flat/sprite_0003.png', ['foliage', 'billboard', 'vegetation', 'flat']),
  'sprite.foliage.flat-04': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/flat/sprite_0004.png', ['foliage', 'billboard', 'vegetation', 'flat']),
  'sprite.foliage.shaded-01': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/shaded/sprite_0052.png', ['foliage', 'billboard', 'vegetation', 'shaded']),
  'sprite.foliage.shaded-02': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/shaded/sprite_0053.png', ['foliage', 'billboard', 'vegetation', 'shaded']),
  'sprite.foliage.shaded-03': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/shaded/sprite_0054.png', ['foliage', 'billboard', 'vegetation', 'shaded']),
  'sprite.foliage.shaded-04': materialized('kenney-foliage-sprites', 'foliage-sprite', 'assets/vendor/public-web/kenney-foliage-sprites/shaded/sprite_0055.png', ['foliage', 'billboard', 'vegetation', 'shaded']),

  'vfx.smoke.white-puff-a': materialized('kenney-smoke-particles', 'vfx-texture', 'assets/vendor/public-web/kenney-smoke-particles/white-puff/whitePuff00.png', ['smoke', 'mist', 'dust', 'forest']),
  'vfx.smoke.white-puff-b': materialized('kenney-smoke-particles', 'vfx-texture', 'assets/vendor/public-web/kenney-smoke-particles/white-puff/whitePuff04.png', ['smoke', 'mist', 'dust', 'impact']),
  'lighting.mask.noise': materialized('kenney-light-masks-phase4', 'light-mask', 'assets/vendor/public-web/kenney-light-masks-phase4/circle_a_noise.png', ['light', 'mask', 'noise', 'forest']),
  'lighting.mask.streaks-noise': materialized('kenney-light-masks-phase4', 'light-mask', 'assets/vendor/public-web/kenney-light-masks-phase4/circle_a_streaks_noise.png', ['light', 'mask', 'streaks', 'forest']),

  'material.wood-planks': asset({
    sourceId: 'polyhaven-wood-planks',
    category: 'pbr-material',
    status: 'MATERIALIZED',
    localPaths: Object.freeze({
      diffuse: 'assets/vendor/public-web/polyhaven-wood-planks/1k/diffuse.jpg',
      normalGL: 'assets/vendor/public-web/polyhaven-wood-planks/1k/normal-gl.jpg',
      roughness: 'assets/vendor/public-web/polyhaven-wood-planks/1k/roughness.jpg',
    }),
    tags: ['wood', 'planks', 'weathered', 'building', 'floor', '1k'],
    apps: ALL_APPS,
  }),
});

export function publicWebPhase4AssetsForApp(appId, { statuses } = {}) {
  if (!ALL_APPS.includes(appId)) throw new Error(`Unknown app for public web phase 4 assets: ${appId}`);
  const allowed = statuses ? new Set(statuses) : null;
  return Object.values(publicWebPhase4AssetCatalog).filter(item => !allowed || allowed.has(item.status));
}
