const materialRows = node => (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);

export function estimateTextureBytes(texture) {
  const image = texture?.image;
  const width = Number(image?.width || image?.videoWidth || 0), height = Number(image?.height || image?.videoHeight || 0);
  if (!(width > 0 && height > 0)) return 0;
  const mipFactor = texture.generateMipmaps === false ? 1 : 4 / 3;
  return Math.ceil(width * height * 4 * mipFactor);
}

export function auditTextureBudget(root, { softBytes = 48 * 1024 * 1024, maxDimension = 2048 } = {}) {
  const textures = new Set();
  root?.traverse?.(node => { for (const material of materialRows(node)) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); });
  let estimatedBytes = 0, largestDimension = 0, oversized = 0, uncompressed = 0;
  for (const texture of textures) {
    estimatedBytes += estimateTextureBytes(texture);
    const image = texture.image, width = Number(image?.width || image?.videoWidth || 0), height = Number(image?.height || image?.videoHeight || 0);
    const dimension = Math.max(width, height); largestDimension = Math.max(largestDimension, dimension);
    if (dimension > maxDimension) oversized++;
    const source = String(texture.userData?.source || texture.name || '');
    if (estimateTextureBytes(texture) > 1024 * 1024 && !/\.ktx2($|\?)/i.test(source)) uncompressed++;
  }
  return Object.freeze({ count: textures.size, estimatedBytes, softBytes, largestDimension, maxDimension, oversized, uncompressed, gate: estimatedBytes > softBytes || oversized ? 'review' : 'pass' });
}

export function applyTextureQuality(root, { anisotropy = 4 } = {}) {
  const textures = new Set();
  root?.traverse?.(node => { for (const material of materialRows(node)) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); });
  for (const texture of textures) {
    if ('anisotropy' in texture) texture.anisotropy = Math.max(1, Math.floor(anisotropy));
    texture.needsUpdate = true;
  }
  return { textures: textures.size, anisotropy: Math.max(1, Math.floor(anisotropy)) };
}
