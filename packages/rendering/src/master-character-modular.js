import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial,
  SphereGeometry, TorusGeometry
} from 'three';

const KEY = Symbol.for('soul.master-character.modular-appearance');
const allowed = Object.freeze({
  face: new Set(['classic', 'round', 'sharp', 'long']),
  hair: new Set(['original', 'bob', 'crop', 'tail']),
  body: new Set(['balanced', 'slender', 'sturdy', 'compact']),
  outfit: new Set(['uniform', 'tunic', 'mantle', 'apron']),
  accessory: new Set(['none', 'glasses', 'headband', 'scarf'])
});
const BASE = Object.freeze({ version: 1, face: 'classic', hair: 'original', body: 'balanced', outfit: 'uniform', accessory: 'none' });
const faceScale = Object.freeze({
  classic: [1, 1, 1], round: [1.08, .96, 1.05], sharp: [.94, 1.04, .96], long: [.96, 1.08, .97]
});
const bodyScale = Object.freeze({
  balanced: [1, 1, 1], slender: [.9, 1.02, .92], sturdy: [1.1, .98, 1.08], compact: [1.04, .94, 1.03]
});
const check = (ok, message) => { if (!ok) throw new Error(message); };

function canonicalProfile(input = BASE) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid modular appearance profile');
  const profile = { ...BASE, ...input, version: 1 };
  for (const [slot, values] of Object.entries(allowed)) check(values.has(profile[slot]), `Invalid modular appearance ${slot}`);
  return Object.freeze(profile);
}

function colorMaterial(name, roughness = .72, metalness = 0) {
  const material = new MeshStandardMaterial({ name, color: 0xffffff, roughness, metalness, side: DoubleSide });
  return material;
}

function addMesh(group, geometry, material, name, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name; mesh.position.fromArray(position); mesh.rotation.set(...rotation); mesh.scale.fromArray(scale);
  mesh.castShadow = false; mesh.receiveShadow = false; group.add(mesh); return mesh;
}

function hideChildren(root) { for (const child of root.children) child.visible = false; }
function showNamed(root, name) { hideChildren(root); const target = root.getObjectByName(name); if (target) target.visible = true; }

/**
 * Adds an opt-in visual variation layer to an existing pooled MasterCharacter actor.
 * The source Shino body stays complete and clothed. Alternate outfits are overlays;
 * this module never hides the source body/clothes or treats missing covered geometry as skin.
 * Gameplay collision, inventory and simulation state remain caller-owned.
 */
export function attachModularAppearanceController(actor) {
  check(actor?.root?.isObject3D && actor?.visual?.isObject3D && actor?.bones?.head?.isBone && actor?.bones?.spine?.isBone,
    'A spawned humanoid actor is required');
  if (actor[KEY]) return actor[KEY];

  const geometries = new Set(), modularMaterials = new Set();
  const geometry = factory => { const value = factory(); geometries.add(value); return value; };
  const hairMaterial = colorMaterial('MC_HAIR'); modularMaterials.add(hairMaterial);
  const clothMaterial = colorMaterial('MC_CLOTH'); modularMaterials.add(clothMaterial);
  const accentMaterial = colorMaterial('MC_ACCENT', .5, .08); modularMaterials.add(accentMaterial);
  const darkMaterial = colorMaterial('MC_DARK', .42, .2); darkMaterial.color.setRGB(.08, .07, .06); modularMaterials.add(darkMaterial);

  const hairRoot = new Group(); hairRoot.name = 'mc-hair-root'; actor.bones.head.add(hairRoot);
  const outfitRoot = new Group(); outfitRoot.name = 'mc-outfit-root'; actor.bones.spine.add(outfitRoot);
  const headAccessoryRoot = new Group(); headAccessoryRoot.name = 'mc-head-accessory-root'; actor.bones.head.add(headAccessoryRoot);
  const torsoAccessoryRoot = new Group(); torsoAccessoryRoot.name = 'mc-torso-accessory-root'; actor.bones.spine.add(torsoAccessoryRoot);

  const capGeometry = geometry(() => new SphereGeometry(.145, 14, 10, 0, Math.PI * 2, 0, Math.PI * .72));
  const lockGeometry = geometry(() => new BoxGeometry(.052, .19, .07));
  const tailGeometry = geometry(() => new CylinderGeometry(.035, .058, .28, 8));
  const tunicGeometry = geometry(() => new CylinderGeometry(.205, .28, .44, 10, 1, true));
  const panelGeometry = geometry(() => new BoxGeometry(.39, .48, .025));
  const apronGeometry = geometry(() => new BoxGeometry(.29, .40, .018));
  const beltGeometry = geometry(() => new BoxGeometry(.37, .045, .045));
  const torusEyeGeometry = geometry(() => new TorusGeometry(.044, .008, 6, 14));
  const bridgeGeometry = geometry(() => new BoxGeometry(.035, .009, .008));
  const headbandGeometry = geometry(() => new TorusGeometry(.135, .012, 6, 20));
  const scarfGeometry = geometry(() => new TorusGeometry(.12, .026, 7, 20));

  const bob = new Group(); bob.name = 'hair:bob';
  addMesh(bob, capGeometry, hairMaterial, 'bob-cap', [0, .055, -.006], [0, 0, 0], [1.05, .92, 1.03]);
  addMesh(bob, lockGeometry, hairMaterial, 'bob-left', [-.105, -.04, .005], [0, 0, -.08]);
  addMesh(bob, lockGeometry, hairMaterial, 'bob-right', [.105, -.04, .005], [0, 0, .08]);
  hairRoot.add(bob);

  const crop = new Group(); crop.name = 'hair:crop';
  addMesh(crop, capGeometry, hairMaterial, 'crop-cap', [0, .064, -.008], [0, 0, 0], [.96, .68, .96]);
  hairRoot.add(crop);

  const tail = new Group(); tail.name = 'hair:tail';
  addMesh(tail, capGeometry, hairMaterial, 'tail-cap', [0, .06, -.008], [0, 0, 0], [1, .76, 1]);
  addMesh(tail, tailGeometry, hairMaterial, 'tail-lock', [0, -.045, -.17], [.28, 0, 0]);
  hairRoot.add(tail);

  const tunic = new Group(); tunic.name = 'outfit:tunic';
  addMesh(tunic, tunicGeometry, clothMaterial, 'tunic-body', [0, -.13, 0], [0, 0, 0], [1, 1, .78]); outfitRoot.add(tunic);
  const mantle = new Group(); mantle.name = 'outfit:mantle';
  addMesh(mantle, panelGeometry, clothMaterial, 'mantle-back', [0, -.11, -.14], [.04, 0, 0]);
  addMesh(mantle, beltGeometry, accentMaterial, 'mantle-collar', [0, .09, -.03], [0, 0, 0], [1.02, .8, 1.15]); outfitRoot.add(mantle);
  const apron = new Group(); apron.name = 'outfit:apron';
  addMesh(apron, apronGeometry, clothMaterial, 'apron-front', [0, -.13, .145]);
  addMesh(apron, beltGeometry, accentMaterial, 'apron-belt', [0, .055, .02]); outfitRoot.add(apron);

  const glasses = new Group(); glasses.name = 'accessory:glasses';
  addMesh(glasses, torusEyeGeometry, darkMaterial, 'glasses-left', [-.055, .018, .118]);
  addMesh(glasses, torusEyeGeometry, darkMaterial, 'glasses-right', [.055, .018, .118]);
  addMesh(glasses, bridgeGeometry, darkMaterial, 'glasses-bridge', [0, .018, .118]); headAccessoryRoot.add(glasses);
  const headband = new Group(); headband.name = 'accessory:headband';
  addMesh(headband, headbandGeometry, accentMaterial, 'headband-ring', [0, .075, 0], [Math.PI / 2, 0, 0]); headAccessoryRoot.add(headband);
  const scarf = new Group(); scarf.name = 'accessory:scarf';
  addMesh(scarf, scarfGeometry, accentMaterial, 'scarf-ring', [0, .095, 0], [Math.PI / 2, 0, 0], [1.15, 1, 1]); torsoAccessoryRoot.add(scarf);

  const sourceHairMaterials = new Set();
  actor.visual.traverse(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material && /HAIR/i.test(material.name)) sourceHairMaterials.add(material);
  });

  let profile = canonicalProfile(BASE), lastAppearance = null, disposed = false;
  const baseSample = actor.sample.bind(actor), baseReset = actor.reset.bind(actor), baseDestroy = actor.destroy?.bind(actor);

  function restoreSourceHair() { sourceHairMaterials.forEach(material => { material.visible = true; }); }
  function hideAllParts() { hideChildren(hairRoot); hideChildren(outfitRoot); hideChildren(headAccessoryRoot); hideChildren(torsoAccessoryRoot); }
  function apply() {
    if (!lastAppearance || disposed) return;
    const face = faceScale[profile.face], body = bodyScale[profile.body];
    actor.bones.head.scale.x *= face[0]; actor.bones.head.scale.y *= face[1]; actor.bones.head.scale.z *= face[2];
    actor.root.scale.x *= body[0]; actor.root.scale.y *= body[1]; actor.root.scale.z *= body[2];

    hairMaterial.color.setRGB(...lastAppearance.hair);
    clothMaterial.color.setRGB(...lastAppearance.dye);
    accentMaterial.color.copy(new Color(...lastAppearance.dye)).lerp(new Color(...lastAppearance.hair), .22);

    restoreSourceHair(); hideAllParts();
    if (profile.hair !== 'original') {
      sourceHairMaterials.forEach(material => { material.visible = false; });
      showNamed(hairRoot, `hair:${profile.hair}`);
    }
    if (profile.outfit !== 'uniform') showNamed(outfitRoot, `outfit:${profile.outfit}`);
    if (profile.accessory === 'glasses' || profile.accessory === 'headband') showNamed(headAccessoryRoot, `accessory:${profile.accessory}`);
    if (profile.accessory === 'scarf') showNamed(torsoAccessoryRoot, 'accessory:scarf');
    actor.root.updateWorldMatrix(true, true);
  }

  actor.sample = (appearance, ...args) => { baseSample(appearance, ...args); lastAppearance = appearance; apply(); };
  actor.reset = () => {
    restoreSourceHair(); hideAllParts(); profile = canonicalProfile(BASE); lastAppearance = null; baseReset();
  };
  if (baseDestroy) actor.destroy = () => {
    if (disposed) return; baseDestroy(); disposed = true;
    modularMaterials.forEach(material => material.dispose()); geometries.forEach(value => value.dispose());
  };

  const controller = {
    get profile() { return profile; },
    setProfile(next) { profile = canonicalProfile(next); actor.resetSecondary?.(); apply(); return profile; },
    resetProfile() { return controller.setProfile(BASE); },
    apply,
    diagnostics() { return { sourceHairMaterials: sourceHairMaterials.size, face: profile.face, hair: profile.hair,
      body: profile.body, outfit: profile.outfit, accessory: profile.accessory }; }
  };
  actor[KEY] = controller; return controller;
}
