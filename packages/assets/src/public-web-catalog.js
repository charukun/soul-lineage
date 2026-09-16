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
    archiveUrl: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    archiveSha256: '029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8', redistributionAllowed: true,
  }),
  'kenney-interface-sounds': source({
    provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/interface-sounds',
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
  'kenney-particle-pack': source({ provider: 'Kenney', license: 'CC0-1.0', canonicalUrl: 'https://kenney.nl/assets/particle-pack', redistributionAllowed: true }),
  'polyhaven-medieval-blocks-05': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/medieval_blocks_05', redistributionAllowed: true }),
  'polyhaven-grassy-cobblestone': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/grassy_cobblestone', redistributionAllowed: true }),
  'polyhaven-cobblestone-01': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/cobblestone_01', redistributionAllowed: true }),
  'polyhaven-zavelstein': source({ provider: 'Poly Haven', license: 'CC0-1.0', canonicalUrl: 'https://polyhaven.com/a/zavelstein', redistributionAllowed: true }),
  'ambientcg-wood-siding-006': source({ provider: 'ambientCG', license: 'CC0-1.0', canonicalUrl: 'https://ambientcg.com/view?id=WoodSiding006', redistributionAllowed: true }),
});

export const publicWebAssetCatalog = Object.freeze({
  'vfx.simplex-noise-2d': asset({ sourceId: 'stegu-webgl-noise', category: 'vfx-shader', status: 'MATERIALIZED', localPath: 'assets/vendor/public-web/stegu-webgl-noise/noise2D.glsl', tags: ['noise', 'smoke', 'dissolve', 'distortion'] }),
  'vfx.simplex-noise-3d': asset({ sourceId: 'stegu-webgl-noise', category: 'vfx-shader', status: 'MATERIALIZED', localPath: 'assets/vendor/public-web/stegu-webgl-noise/noise3D.glsl', tags: ['noise', 'fire', 'fog', 'magic'] }),
  'audio.impact': asset({ sourceId: 'kenney-impact-sounds', category: 'audio', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['combat', 'hit', 'impact'] }),
  'audio.interface': asset({ sourceId: 'kenney-interface-sounds', category: 'audio', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['ui', 'menu', 'feedback'] }),
  'audio.ui': asset({ sourceId: 'kenney-ui-audio', category: 'audio', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['ui', 'confirm', 'cancel'] }),
  'model.nature-kit': asset({ sourceId: 'kenney-nature-kit', category: '3d', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['tree', 'rock', 'vegetation'] }),
  'vfx.particle-pack': asset({ sourceId: 'kenney-particle-pack', category: 'vfx-texture', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['spark', 'slash', 'smoke', 'magic'] }),
  'material.medieval-blocks': asset({ sourceId: 'polyhaven-medieval-blocks-05', category: 'pbr-material', status: 'AUDITED_REMOTE_CANDIDATE', tags: ['wall', 'stone', 'medieval'] }),
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
