const freeze = value => Object.freeze(value);

export const VISUAL_QUALITY_FLOORS = freeze({
  hero: freeze({ minVfxScale: .88, minTextureAnisotropy: 4, minAnimationHz: 60, preserveShadow: true, preserveRim: true, allowOcclusion: false, allowImpostor: false }),
  enemy: freeze({ minVfxScale: .74, minTextureAnisotropy: 2, minAnimationHz: 15, preserveShadow: true, preserveRim: true, allowOcclusion: false, allowImpostor: false }),
  npc: freeze({ minVfxScale: .42, minTextureAnisotropy: 1, minAnimationHz: 8, preserveShadow: false, preserveRim: false, allowOcclusion: true, allowImpostor: true }),
  environment: freeze({ minVfxScale: .25, minTextureAnisotropy: 1, minAnimationHz: 0, preserveShadow: false, preserveRim: false, allowOcclusion: true, allowImpostor: true }),
  critical: freeze({ minVfxScale: .9, minTextureAnisotropy: 2, minAnimationHz: 30, preserveShadow: true, preserveRim: true, allowOcclusion: false, allowImpostor: false }),
});

export function visualQualityFloor(role = 'environment') {
  return VISUAL_QUALITY_FLOORS[role] || VISUAL_QUALITY_FLOORS.environment;
}

export function applyVisualQualityFloor(profile, role = 'environment') {
  if (!profile || typeof profile !== 'object') throw new Error('Visual quality floor requires a quality profile');
  const floor = visualQualityFloor(role);
  return Object.freeze({ ...profile, vfxScale: Math.max(Number(profile.vfxScale) || 0, floor.minVfxScale), textureAnisotropy: Math.max(Number(profile.textureAnisotropy) || 1, floor.minTextureAnisotropy), qualityFloorRole: role });
}

export function markVisualQualityPriority(root, role = 'critical') {
  const floor = visualQualityFloor(role);
  root?.traverse?.(node => {
    node.userData = node.userData || {};
    node.userData.visualQualityFloor = role;
    if (!floor.allowOcclusion) node.userData.occlusionDisabled = true;
    if (!floor.allowImpostor) node.userData.impostorDisabled = true;
    if (!floor.allowOcclusion || !floor.allowImpostor) node.userData.streamingCritical = true;
  });
  return floor;
}
