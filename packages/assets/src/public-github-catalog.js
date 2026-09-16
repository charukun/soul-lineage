export const PUBLIC_GITHUB_ASSET_SOURCE = Object.freeze({
  repository: 'KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0',
  commit: '84fa4e91af6a88989be7c99e0891cede11f2ca38',
  license: 'CC0-1.0',
  repositoryRoot: 'assets/vendor/public-github/kaykit-medieval-hexagon',
  manifest: 'assets/vendor/public-github/kaykit-medieval-hexagon/MANIFEST.json',
});

const ALL_APPS = Object.freeze(['rinne', 'village', 'demon']);

function candidate(id, category, source, tags) {
  return Object.freeze({
    id,
    category,
    source,
    apps: ALL_APPS,
    tags: Object.freeze(tags),
    gltf: `${PUBLIC_GITHUB_ASSET_SOURCE.repositoryRoot}/${category}/${source}.gltf`,
    status: 'VISUAL_CANDIDATE',
  });
}

export const publicGithubAssetCatalog = Object.freeze({
  'arrow-bucket': candidate('arrow-bucket', 'props', 'bucket_arrows', ['camp', 'archery', 'training']),
  ladder: candidate('ladder', 'props', 'ladder', ['settlement', 'work', 'ruin']),
  'lumber-pile': candidate('lumber-pile', 'props', 'resource_lumber', ['resource', 'construction', 'work']),
  'stone-pile': candidate('stone-pile', 'props', 'resource_stone', ['resource', 'construction', 'ruin']),
  sack: candidate('sack', 'props', 'sack', ['storage', 'market', 'camp']),
  'training-target': candidate('training-target', 'props', 'target', ['training', 'guard', 'encounter']),
  tent: candidate('tent', 'props', 'tent', ['camp', 'travel', 'encounter']),
  'weapon-rack': candidate('weapon-rack', 'props', 'weaponrack', ['weapon', 'training', 'guard']),
  wheelbarrow: candidate('wheelbarrow', 'props', 'wheelbarrow', ['work', 'construction', 'farm']),
  'tree-a': candidate('tree-a', 'nature', 'tree_single_A', ['tree', 'forest', 'roadside']),
  'tree-b': candidate('tree-b', 'nature', 'tree_single_B', ['tree', 'forest', 'roadside']),
  'rock-a': candidate('rock-a', 'nature', 'rock_single_A', ['rock', 'terrain', 'ruin']),
  'rock-c': candidate('rock-c', 'nature', 'rock_single_C', ['rock', 'terrain', 'ruin']),
});

export function publicGithubAssetsForApp(app) {
  if (!ALL_APPS.includes(app)) throw new Error(`Unknown app for public GitHub assets: ${app}`);
  return Object.values(publicGithubAssetCatalog).filter(asset => asset.apps.includes(app));
}
