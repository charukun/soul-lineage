import { stylizedArtProfile } from '@soul/characters';

const strengthFor = id => ({ hero: .10, npc: .065, enemy: .085, environment: .025, prop: .035, distant: 0 }[id] ?? .04);

function install(material, profileId) {
  if (!material?.isMeshStandardMaterial || material.userData?.soulStylizedShader) return false;
  const strength = strengthFor(profileId);
  if (strength <= 0) return false;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = shader => {
    if (typeof previous === 'function') previous(shader);
    shader.uniforms.soulRimStrength = { value: strength };
    shader.fragmentShader = `uniform float soulRimStrength;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\nfloat soulRim = pow(1.0 - max(dot(normalize(normal), normalize(-vViewPosition)), 0.0), 3.0);\ntotalEmissiveRadiance += diffuseColor.rgb * soulRim * soulRimStrength;`);
  };
  material.customProgramCacheKey = () => `${previousKey ? previousKey() : ''}|soul-rim:${profileId}:${strength}`;
  material.userData = material.userData || {};
  material.userData.soulStylizedShader = { profileId, rimStrength: strength };
  material.needsUpdate = true;
  return true;
}

export function applyStylizedShading(root, profileId) {
  stylizedArtProfile(profileId);
  const seen = new Set(); let materials = 0;
  root?.traverse?.(node => {
    const rows = (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);
    for (const material of rows) if (!seen.has(material)) { seen.add(material); if (install(material, profileId)) materials++; }
  });
  return { profileId, materials };
}
