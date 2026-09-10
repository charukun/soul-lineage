export const assetCatalog = Object.freeze({
  'furniture.bench.oak.v1': Object.freeze({ id: 'furniture.bench.oak.v1', type: 'furniture', dimensions: [2.2, 1.1, 0.75], color: '#aa7851' }),
  'building.cottage.v1': Object.freeze({ id: 'building.cottage.v1', type: 'building', dimensions: [4, 3, 4] }),
});
export const sharedEmblemUrl = new URL('./emblem.svg', import.meta.url).href;
export function assetById(id) {
  const asset = assetCatalog[id];
  if (!asset) throw new Error(`Unknown shared asset: ${id}`);
  return asset;
}
