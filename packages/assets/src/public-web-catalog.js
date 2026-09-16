const ALL_APPS = Object.freeze(['rinne', 'village', 'demon']);

const source = value => Object.freeze(value);
const asset = value => Object.freeze({ ...value, apps: ALL_APPS });

export const PUBLIC_WEB_ASSET_SOURCES = Object.freeze({
  'stegu-webgl-noise': source({
    provider: 'stegu/webgl-noise', license: 'MIT', commit: '22434e04d7753f7e949e8d724ab3da2864c17a0f',
    canonicalUrl: 'https://github.com/stegu/webgl-noise', repositoryRoot: 'assets/vendor/public-web/stegu-webgl-noise', redistributionAllowed: true,
  }),
  'kenney-impact-sounds': source({
    provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/impact-sounds',
    mirrorRepository: 'Boyquotes/kenney-impact-sounds-for-godot', mirrorCommit: '999dd1684873f8b020a3aa5b26e713da21688924',
    repositoryRoot: 'assets/vendor/public-web/kenney-impact-sounds',
    archiveUrl: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    archiveSha256: '029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8', redistributionAllowed: true,
  }),
  'kenney-interface-sounds': source({
    provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/interface-sounds',
    mirrorRepository: 'Calinou/kenney-interface-sounds', mirrorCommit: '4596a49eaf5a533948d49a47467f606bcdea70ff',
    repositoryRoot: 'assets/vendor/public-web/kenney-interface-sounds',
    archiveUrl: 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
    archiveSha256: 'f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232', redistributionAllowed: true,
  }),
  'kenney-ui-audio': source({
    provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/ui-audio',
    archiveUrl: 'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip', redistributionAllowed: true,
  }),
  'kenney-nature-kit': source({
    provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/nature-kit',
    archiveUrl: 'https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip',
    archiveSha256: 'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d', redistributionAllowed: true,
  }),
  'kenney-particle-pack': source({
    provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/particle-pack',
    mirrorRepository: 'Calinou/kenney-particle-pack', mirrorCommit: 'ab7086639ee73be31abd87feb21bf1402d4e8144',
    repositoryRoot: 'assets/vendor/public-web/kenney-particle-pack', redistributionAllowed: true,
  }),
  'polyhaven-medieval-blocks-05': source({
    provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/medieval_blocks_05',
    repositoryRoot: 'assets/vendor/public-web/polyhaven-medieval-blocks-05', redistributionAllowed: true,
  }),
  'polyhaven-grassy-cobblestone': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/grassy_cobblestone', redistributionAllowed: true }),
  'polyhaven-cobblestone-01': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/cobblestone_01', redistributionAllowed: true }),
  'polyhaven-zavelstein': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/zavelstein', redistributionAllowed: true }),
  'ambientcg-wood-siding-006': source({ provider: 'ambientCG', license: 'CC0-1.0', canonicalUrl: 'https://ambientcg.com/view?id=WoodSiding006', redistributionAllowed: true }),
});

const materialized = (sourceId, category, localPath, tags) => asset({ sourceId, category, status: 'MATERIALIZED', localPath, tags });

export const publicWebAssetCatalog = Object.freeze({
  'vfx.simplex-noise-2d': materialized('stegu-webgl-noise', 'vfx-shader', 'assets/vendor/public-web/stegu-webgl-noise/noise2D.glsl', ['noise', 'smoke', 'dissolve', 'distortion']),
  'vfx.simplex-noise-3d': materialized('stegu-webgl-noise', 'vfx-shader', 'assets/vendor/public-web/stegu-webgl-noise/noise3D.glsl', ['noise', 'fire', 'fog', 'magic']),

  'audio.ui-confirm': materialized('kenney-interface-sounds', 'audio', 'assets/vendor/public-web/kenney-interface-sounds/ui/confirm.wav', ['ui', 'confirm', 'positive']),
  'audio.ui-error': materialized('kenney-interface-sounds', 'audio', 'assets/vendor/public-web/kenney-interface-sounds/ui/error.wav', ['ui', 'error', 'negative']),
  'audio.ui-select': materialized('kenney-interface-sounds', 'audio', 'assets/vendor/public-web/kenney-interface-sounds/ui/select.wav', ['ui', 'select', 'navigation']),
  'audio.ui-click': materialized('kenney-interface-sounds', 'audio', 'assets/vendor/public-web/kenney-interface-sounds/ui/click.wav', ['ui', 'click', 'button']),
  'audio.ui-toggle': materialized('kenney-interface-sounds', 'audio', 'assets/vendor/public-web/kenney-interface-sounds/ui/toggle.wav', ['ui', 'toggle', 'switch']),

  'audio.hit-metal-heavy': materialized('kenney-impact-sounds', 'audio', 'assets/vendor/public-web/kenney-impact-sounds/combat/metal-heavy.ogg', ['combat', 'hit', 'metal', 'heavy']),
  'audio.hit-punch-medium': materialized('kenney-impact-sounds', 'audio', 'assets/vendor/public-web/kenney-impact-sounds/combat/punch-medium.ogg', ['combat', 'hit', 'flesh', 'medium']),
  'audio.hit-wood-heavy': materialized('kenney-impact-sounds', 'audio', 'assets/vendor/public-web/kenney-impact-sounds/combat/wood-heavy.ogg', ['combat', 'hit', 'wood', 'heavy']),
  'audio.hit-generic-light': materialized('kenney-impact-sounds', 'audio', 'assets/vendor/public-web/kenney-impact-sounds/combat/generic-light.ogg', ['combat', 'hit', 'generic', 'light']),
  'audio.footstep-grass': materialized('kenney-impact-sounds', 'audio', 'assets/vendor/public-web/kenney-impact-sounds/footsteps/grass.ogg', ['footstep', 'grass', 'movement']),
  'audio.footstep-wood': materialized('kenney-impact-sounds', 'audio', 'assets/vendor/public-web/kenney-impact-sounds/footsteps/wood.ogg', ['footstep', 'wood', 'movement']),

  'vfx.spark': materialized('kenney-particle-pack', 'vfx-texture', 'assets/vendor/public-web/kenney-particle-pack/vfx/spark.png', ['spark', 'hit', 'metal']),
  'vfx.slash': materialized('kenney-particle-pack', 'vfx-texture', 'assets/vendor/public-web/kenney-particle-pack/vfx/slash.png', ['slash', 'sword', 'trail']),
  'vfx.smoke': materialized('kenney-particle-pack', 'vfx-texture', 'assets/vendor/public-web/kenney-particle-pack/vfx/smoke.png', ['smoke', 'dust', 'impact']),
  'vfx.flare': materialized('kenney-particle-pack', 'vfx-texture', 'assets/vendor/public-web/kenney-particle-pack/vfx/flare.png', ['flare', 'flash', 'impact']),
  'vfx.magic': materialized('kenney-particle-pack', 'vfx-texture', 'assets/vendor/public-web/kenney-particle-pack/vfx/magic.png', ['magic', 'aura', 'skill']),

  'material.medieval-blocks': asset({
    sourceId: 'polyhaven-medieval-blocks-05', category: 'pbr-material', status: 'MATERIALIZED',
    localPaths: Object.freeze({
      diffuse: 'assets/vendor/public-web/polyhaven-medieval-blocks-05/1k/diffuse.jpg',
      normalGL: 'assets/vendor/public-web/polyhaven-medieval-blocks-05/1k/normal-gl.jpg',
      roughness: 'assets/vendor/public-web/polyhaven-medieval-blocks-05/1k/roughness.jpg',
    }),
    tags: ['wall', 'stone', 'medieval', 'ground', '1k'],
  }),

  'audio.impact-pack': asset({ sourceId: 'kenney-impact-sounds', category: 'audio-pack', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['combat', 'hit', 'impact', 'full-pack'] }),
  'audio.interface-pack': asset({ sourceId: 'kenney-interface-sounds', category: 'audio-pack', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['ui', 'menu', 'feedback', 'full-pack'] }),
  'audio.ui-pack': asset({ sourceId: 'kenney-ui-audio', category: 'audio-pack', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['ui', 'confirm', 'cancel', 'full-pack'] }),
  'model.nature-kit': asset({ sourceId: 'kenney-nature-kit', category: '3d', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['tree', 'rock', 'vegetation'] }),
  'vfx.particle-pack': asset({ sourceId: 'kenney-particle-pack', category: 'vfx-texture-pack', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['spark', 'slash', 'smoke', 'magic', 'full-pack'] }),
  'material.grassy-cobblestone': asset({ sourceId: 'polyhaven-grassy-cobblestone', category: 'pbr-material', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['road', 'village', 'ground'] }),
  'material.cobblestone': asset({ sourceId: 'polyhaven-cobblestone-01', category: 'pbr-material', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['road', 'ground', 'ruin'] }),
  'lighting.zavelstein': asset({ sourceId: 'polyhaven-zavelstein', category: 'hdri', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['forest', 'outdoor', 'lighting'] }),
  'material.wood-siding': asset({ sourceId: 'ambientcg-wood-siding-006', category: 'pbr-material', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['wood', 'building', 'prop'] }),
});

export function publicWebAssetsForApp(appId, { statuses } = {}) {
  if (!ALL_APPS.includes(appId)) throw new Error(`Unknown app for public web assets: ${appId}`);
  const allowed = statuses ? new Set(statuses) : null;
  return Object.values(publicWebAssetCatalog).filter(item => item.apps.includes(appId) && (!allowed || allowed.has(item.status)));
}
