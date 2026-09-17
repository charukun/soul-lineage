const materialRows = node => (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);
const MiB = 1024 * 1024;

function textureDimensions(texture) {
  const image = texture?.image;
  return {
    width: Number(image?.width || image?.videoWidth || 0),
    height: Number(image?.height || image?.videoHeight || 0),
  };
}

function byteLength(value) {
  if (!value) return 0;
  if (Number.isFinite(value.byteLength)) return Number(value.byteLength);
  if (Number.isFinite(value.length)) return Number(value.length);
  return 0;
}

function compressedMipBytes(texture) {
  if (!texture?.isCompressedTexture || !Array.isArray(texture.mipmaps)) return 0;
  return texture.mipmaps.reduce((sum, mip) => sum + byteLength(mip?.data), 0);
}

function textureSource(texture) {
  return String(
    texture?.userData?.source ||
    texture?.userData?.sourceUrl ||
    texture?.sourceUrl ||
    texture?.image?.currentSrc ||
    texture?.image?.src ||
    texture?.name ||
    '',
  );
}

function textureLabel(texture, source) {
  const raw = String(texture?.name || source || texture?.uuid || 'texture');
  return raw.split(/[\\/]/).pop()?.split('?')[0] || raw;
}

function isCompressedTexture(texture, source = textureSource(texture)) {
  return Boolean(texture?.isCompressedTexture || /\.(ktx2|basis)(?:$|\?)/i.test(source));
}

function visitMaterialTextures(material, callback) {
  for (const [slot, value] of Object.entries(material || {})) {
    if (value?.isTexture) callback(value, slot);
  }
  const uniforms = material?.uniforms;
  if (!uniforms || typeof uniforms !== 'object') return;
  for (const [name, uniform] of Object.entries(uniforms)) {
    const value = uniform?.value;
    if (value?.isTexture) callback(value, `uniform:${name}`);
  }
}

export function estimateTextureBytes(texture) {
  const explicit = Number(texture?.userData?.estimatedGpuBytes || texture?.userData?.gpuBytes || 0);
  if (explicit > 0) return Math.ceil(explicit);
  const compressedBytes = compressedMipBytes(texture);
  if (compressedBytes > 0) return compressedBytes;
  const { width, height } = textureDimensions(texture);
  if (!(width > 0 && height > 0)) return 0;
  const mipFactor = texture.generateMipmaps === false ? 1 : 4 / 3;
  return Math.ceil(width * height * 4 * mipFactor);
}

/**
 * Non-mutating texture residency audit. Existing aggregate fields stay stable,
 * while `textures` and `offenders` identify concrete sources/material slots so
 * large allocations can be fixed without blindly reducing global quality.
 */
export function auditTextureBudget(root, {
  softBytes = 48 * MiB,
  maxDimension = 2048,
  largeTextureBytes = 1 * MiB,
  maxOffenders = 12,
} = {}) {
  const records = new Map();
  root?.traverse?.(node => {
    for (const material of materialRows(node)) {
      visitMaterialTextures(material, (texture, slot) => {
        let record = records.get(texture);
        if (!record) {
          const source = textureSource(texture);
          const { width, height } = textureDimensions(texture);
          const estimatedBytes = estimateTextureBytes(texture);
          const compressed = isCompressedTexture(texture, source);
          record = {
            label: textureLabel(texture, source),
            source,
            width,
            height,
            dimension: Math.max(width, height),
            estimatedBytes,
            compressed,
            usages: [],
            usageKeys: new Set(),
          };
          records.set(texture, record);
        }
        const nodeLabel = String(node?.name || node?.userData?.assetId || node?.type || 'Object3D');
        const materialLabel = String(material?.name || material?.uuid || material?.type || 'material');
        const key = `${node?.uuid || nodeLabel}|${material?.uuid || materialLabel}|${slot}`;
        if (record.usageKeys.has(key)) return;
        record.usageKeys.add(key);
        record.usages.push(Object.freeze({ node: nodeLabel, material: materialLabel, slot }));
      });
    }
  });

  let estimatedBytes = 0, largestDimension = 0, oversized = 0, uncompressed = 0;
  const textures = [...records.values()].map(record => {
    estimatedBytes += record.estimatedBytes;
    largestDimension = Math.max(largestDimension, record.dimension);
    const isOversized = record.dimension > maxDimension;
    const isLargeUncompressed = record.estimatedBytes > largeTextureBytes && !record.compressed;
    if (isOversized) oversized++;
    if (isLargeUncompressed) uncompressed++;
    return Object.freeze({
      label: record.label,
      source: record.source,
      width: record.width,
      height: record.height,
      dimension: record.dimension,
      estimatedBytes: record.estimatedBytes,
      compressed: record.compressed,
      oversized: isOversized,
      largeUncompressed: isLargeUncompressed,
      usages: Object.freeze(record.usages),
    });
  }).sort((a, b) => b.estimatedBytes - a.estimatedBytes || b.dimension - a.dimension || a.label.localeCompare(b.label));

  const offenders = textures
    .filter(row => row.oversized || row.largeUncompressed)
    .slice(0, Math.max(0, Math.floor(maxOffenders)));
  const gate = estimatedBytes > softBytes || oversized ? 'review' : 'pass';
  const reasons = [];
  if (estimatedBytes > softBytes) reasons.push(`estimatedBytes ${estimatedBytes} > ${softBytes}`);
  if (oversized) reasons.push(`${oversized} texture(s) exceed ${maxDimension}px`);

  return Object.freeze({
    count: textures.length,
    estimatedBytes,
    softBytes,
    largestDimension,
    maxDimension,
    oversized,
    uncompressed,
    gate,
    reasons: Object.freeze(reasons),
    textures: Object.freeze(textures),
    offenders: Object.freeze(offenders),
  });
}

export function applyTextureQuality(root, { anisotropy = 4 } = {}) {
  const targetAnisotropy = Math.max(1, Math.floor(anisotropy));
  const textures = new Set();
  root?.traverse?.(node => { for (const material of materialRows(node)) visitMaterialTextures(material, texture => textures.add(texture)); });
  for (const texture of textures) {
    // Pressure-axis changes can reapply the same profile every few frames.
    // Retain a texture's existing dirty state, but do not request a fresh GPU
    // upload when its sampler setting has not changed.
    if ('anisotropy' in texture && texture.anisotropy !== targetAnisotropy) {
      texture.anisotropy = targetAnisotropy;
      texture.needsUpdate = true;
    }
  }
  return { textures: textures.size, anisotropy: targetAnisotropy };
}
