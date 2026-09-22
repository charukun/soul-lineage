import { Color, LightProbe, SphericalHarmonics3, Vector3 } from 'three';

const colorVector = value => {
  const c = new Color(value);
  return new Vector3(c.r, c.g, c.b);
};

/** Low-cost ambient probe matching the shared cool-ambient / warm-local art direction. */
export function createStylizedLightProbe({ cool = 0x9db8d0, ground = 0x63735a, warm = 0xffb56d, intensity = .18 } = {}) {
  const sh = new SphericalHarmonics3();
  const coolV = colorVector(cool), groundV = colorVector(ground), warmV = colorVector(warm);
  sh.coefficients[0].copy(coolV).multiplyScalar(.88);
  sh.coefficients[1].copy(groundV).multiplyScalar(-.08);
  sh.coefficients[2].copy(coolV).multiplyScalar(.06);
  sh.coefficients[3].copy(warmV).multiplyScalar(.045);
  const probe = new LightProbe(sh, intensity);
  probe.userData.soulStylizedLightProbe = true;
  return probe;
}

export function applyAuthoredBakedLighting(root, { lightMapIntensity = .78, aoMapIntensity = .62 } = {}) {
  let lightMapped = 0, aoMapped = 0, materials = 0;
  root?.traverse?.(node => {
    const rows = (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean);
    for (const material of rows) {
      materials++;
      if (material.lightMap) { material.lightMapIntensity = lightMapIntensity; lightMapped++; }
      if (material.aoMap) { material.aoMapIntensity = aoMapIntensity; aoMapped++; }
      if (material.lightMap || material.aoMap) {
        material.userData = material.userData || {};
        material.userData.soulBakedLighting = true;
        material.needsUpdate = true;
      }
    }
  });
  return Object.freeze({ materials, lightMapped, aoMapped, lightMapIntensity, aoMapIntensity });
}

export function installStylizedBakedLighting(scene, options = {}) {
  if (!scene?.add) throw new Error('Baked lighting requires a scene');
  const existing = scene.children?.find?.(child => child.userData?.soulStylizedLightProbe);
  const probe = existing || createStylizedLightProbe(options);
  if (!existing) scene.add(probe);
  return {
    probe,
    apply(root, applyOptions = {}) { return applyAuthoredBakedLighting(root, applyOptions); },
    snapshot() { return Object.freeze({ installed: true, intensity: probe.intensity, authored: Boolean(options.authored) }); },
    dispose() { if (probe.parent) probe.parent.remove(probe); },
  };
}
