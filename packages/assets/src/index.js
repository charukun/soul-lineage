export { PUBLIC_GITHUB_ASSET_SOURCE, publicGithubAssetCatalog, publicGithubAssetsForApp } from './public-github-catalog.js';

export const assetCatalog = Object.freeze({
  'furniture.bench.oak.v1': Object.freeze({ id: 'furniture.bench.oak.v1', type: 'furniture', dimensions: [2.2, 1.1, 0.75], color: '#aa7851' }),
  'building.cottage.v1': Object.freeze({ id: 'building.cottage.v1', type: 'building', dimensions: [4, 3, 4] }),
});
export const sharedEmblemUrl = new URL('./emblem.svg', import.meta.url).href;

const iconNames = Object.freeze([
  'menu', 'sword', 'heart', 'sparkles', 'flask-conical', 'book-open', 'backpack', 'hammer', 'map',
  'house', 'settings-2', 'compass', 'chevron-right', 'shield', 'crosshair', 'x', 'moon',
]);
export const sharedIconUrls = Object.freeze(Object.fromEntries(
  iconNames.map(name => [name, new URL(`./icons/lucide/${name}.svg`, import.meta.url).href]),
));
export const sharedIconProvenance = Object.freeze({
  repository: 'lucide-icons/lucide',
  commit: 'a79b2d131dab2bf20cb224bd0937b439a9c4fa99',
  license: 'ISC with MIT notice for Feather-derived glyphs',
});

export function assetById(id) {
  const asset = assetCatalog[id];
  if (!asset) throw new Error(`Unknown shared asset: ${id}`);
  return asset;
}
