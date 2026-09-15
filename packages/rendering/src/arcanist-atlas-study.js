import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry
} from 'three';

export const ARCANIST_ATLAS_STUDY_ID = 'arcanist.atlas-study.v1';
export const ARCANIST_ATLAS_STUDY_STAGE = 'BLOCKOUT';

function rgbMaterial(name, rgb, roughness = .78, metalness = 0) {
  const material = new MeshStandardMaterial({ name, roughness, metalness, side: DoubleSide });
  material.color.setRGB(rgb[0], rgb[1], rgb[2]);
  return material;
}

function addMesh(state, parent, geometry, material, name, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  if (!parent) return null;
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  parent.add(mesh);
  state.meshes.push(mesh);
  state.geometries.add(geometry);
  return mesh;
}

function requireBone(bones, name) {
  const bone = bones?.[name];
  if (!bone) throw new Error(`Arcanist Atlas Study requires humanoid bone: ${name}`);
  return bone;
}

/**
 * Adds the authored comparison layer for the Arcanist reference study.
 *
 * The underlying body/rig remains the existing audited humanoid reference path.
 * This layer is intentionally runtime-procedural and therefore BLOCKOUT only.
 */
export function attachArcanistAtlasStudy(actor, reference) {
  if (!actor?.root || !actor?.bones) throw new Error('Arcanist Atlas Study requires a rigged character actor');
  if (reference?.id !== ARCANIST_ATLAS_STUDY_ID) throw new Error(`Unexpected Arcanist Atlas Study reference: ${reference?.id ?? 'missing'}`);

  const palette = reference.referenceStyle?.palette;
  if (!palette) throw new Error('Arcanist Atlas Study requires a reference palette');

  const state = {
    meshes: [],
    geometries: new Set(),
    materials: new Set(),
    destroyed: false
  };

  const materials = {
    hair: rgbMaterial('atlas:hair', palette.hair, .86),
    primary: rgbMaterial('atlas:primary', palette.primary, .83),
    secondary: rgbMaterial('atlas:secondary', palette.secondary, .78),
    accent: rgbMaterial('atlas:accent', palette.accent, .62, .05),
    dark: rgbMaterial('atlas:dark', palette.dark, .88),
    metal: rgbMaterial('atlas:metal', palette.metal, .38, .62),
    leather: rgbMaterial('atlas:leather', palette.leather, .86),
    wood: rgbMaterial('atlas:wood', palette.wood, .90)
  };
  Object.values(materials).forEach(material => state.materials.add(material));

  const head = requireBone(actor.bones, 'head');
  const spine = requireBone(actor.bones, 'spine');
  const leftLowerArm = requireBone(actor.bones, 'leftLowerArm');
  const rightLowerArm = requireBone(actor.bones, 'rightLowerArm');

  // Hair silhouette: longer framing locks and a visible tie make the reference read
  // from front, profile and back instead of relying on a single generic tail mass.
  const lockGeometry = new SphereGeometry(1, 12, 8);
  addMesh(state, head, lockGeometry, materials.hair, 'atlas:hair-lock-left', [-.088, .012, -.018], [.034, .175, .030], [0, 0, -.11]);
  addMesh(state, head, new SphereGeometry(1, 12, 8), materials.hair, 'atlas:hair-lock-right', [.088, .012, -.018], [.034, .175, .030], [0, 0, .11]);
  addMesh(state, head, new TorusGeometry(.052, .010, 6, 18), materials.accent, 'atlas:hair-tie', [0, .054, -.132], [1, .78, 1], [Math.PI / 2, 0, 0]);
  addMesh(state, head, new SphereGeometry(1, 12, 8), materials.hair, 'atlas:ponytail-lower', [0, -.018, -.176], [.058, .205, .046], [.20, 0, 0]);

  // Complete the baseline round lenses with bridge and temples so the eyewear
  // reads as an intentional object rather than two floating rings.
  addMesh(state, head, new BoxGeometry(1, 1, 1), materials.metal, 'atlas:glasses-bridge', [0, .087, .106], [.026, .004, .004]);
  addMesh(state, head, new BoxGeometry(1, 1, 1), materials.metal, 'atlas:glasses-temple-left', [-.084, .088, .083], [.035, .004, .004], [0, -.42, 0]);
  addMesh(state, head, new BoxGeometry(1, 1, 1), materials.metal, 'atlas:glasses-temple-right', [.084, .088, .083], [.035, .004, .004], [0, .42, 0]);

  // Layered collar and shoulder mantle establish the scholar silhouette before
  // small prop detail. The pieces stay on the shared spine and follow all motion.
  addMesh(state, spine, new TorusGeometry(.145, .023, 8, 28, Math.PI * 1.70), materials.secondary, 'atlas:collar', [0, .205, .005], [1.05, .72, .86], [Math.PI / 2, 0, .48]);
  addMesh(state, spine, new SphereGeometry(1, 14, 9), materials.secondary, 'atlas:mantle-left', [-.155, .126, -.010], [.145, .060, .145], [0, 0, -.10]);
  addMesh(state, spine, new SphereGeometry(1, 14, 9), materials.secondary, 'atlas:mantle-right', [.155, .126, -.010], [.145, .060, .145], [0, 0, .10]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.dark, 'atlas:mantle-back', [0, .075, -.125], [.205, .205, .026], [.06, 0, 0]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.accent, 'atlas:mantle-back-trim', [0, -.114, -.151], [.205, .018, .010], [.06, 0, 0]);

  // Front construction: crossed lapels, waist sash and separated robe panels.
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.primary, 'atlas:lapel-left', [-.064, .035, .122], [.057, .205, .018], [0, 0, -.16]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.primary, 'atlas:lapel-right', [.064, .035, .122], [.057, .205, .018], [0, 0, .16]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.accent, 'atlas:lapel-line-left', [-.027, .035, .143], [.010, .205, .007], [0, 0, -.16]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.accent, 'atlas:lapel-line-right', [.027, .035, .143], [.010, .205, .007], [0, 0, .16]);
  addMesh(state, spine, new TorusGeometry(.168, .014, 7, 26), materials.leather, 'atlas:sash', [0, -.070, .005], [1, 1, .84], [Math.PI / 2, 0, 0]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.primary, 'atlas:robe-panel-left', [-.086, -.335, .075], [.094, .270, .026], [0, 0, -.035]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.primary, 'atlas:robe-panel-right', [.086, -.335, .075], [.094, .270, .026], [0, 0, .035]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.accent, 'atlas:robe-hem-left', [-.086, -.590, .081], [.094, .018, .030], [0, 0, -.035]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.accent, 'atlas:robe-hem-right', [.086, -.590, .081], [.094, .018, .030], [0, 0, .035]);

  // Sleeves keep a readable terminal shape during arm motion.
  addMesh(state, leftLowerArm, new CylinderGeometry(.057, .050, .086, 10), materials.accent, 'atlas:cuff-left', [0, .025, 0]);
  addMesh(state, rightLowerArm, new CylinderGeometry(.057, .050, .086, 10), materials.accent, 'atlas:cuff-right', [0, .025, 0]);

  // Reference-defining scholar gear. These are presentation-only and deliberately
  // do not claim inventory/combat ownership.
  addMesh(state, spine, new CylinderGeometry(.021, .024, .245, 10), materials.leather, 'atlas:scroll-tube-a', [-.205, -.180, .118], [1, 1, 1], [0, 0, -.16]);
  addMesh(state, spine, new CylinderGeometry(.021, .024, .220, 10), materials.leather, 'atlas:scroll-tube-b', [-.252, -.168, .102], [1, 1, 1], [0, 0, -.07]);
  addMesh(state, spine, new TorusGeometry(.024, .006, 6, 14), materials.accent, 'atlas:scroll-cap-a', [-.224, -.058, .118], [1, 1, 1], [Math.PI / 2, 0, -.16]);
  addMesh(state, spine, new TorusGeometry(.024, .006, 6, 14), materials.accent, 'atlas:scroll-cap-b', [-.260, -.058, .102], [1, 1, 1], [Math.PI / 2, 0, -.07]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.leather, 'atlas:satchel-body', [.215, -.205, -.095], [.105, .135, .050], [0, -.10, .04]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.accent, 'atlas:satchel-flap', [.215, -.100, -.145], [.108, .045, .012], [0, -.10, .04]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.leather, 'atlas:satchel-strap', [.075, .010, -.145], [.018, .270, .010], [0, 0, -.55]);

  // The baseline already supplies the staff shaft, gem and book. These pieces give
  // both props a more deliberate silhouette while staying attached to the same rig.
  addMesh(state, spine, new TorusGeometry(.082, .010, 7, 24), materials.metal, 'atlas:staff-halo', [.290, .640, .020], [1, 1, 1], [0, 0, 0]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.metal, 'atlas:staff-prong-left', [.225, .655, .020], [.012, .082, .014], [0, 0, -.35]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.metal, 'atlas:staff-prong-right', [.355, .655, .020], [.012, .082, .014], [0, 0, .35]);
  addMesh(state, spine, new BoxGeometry(1, 1, 1), materials.secondary, 'atlas:book-pages', [-.200, -.120, .158], [.083, .115, .030], [0, 0, .12]);
  addMesh(state, spine, new TorusGeometry(.038, .006, 6, 18), materials.metal, 'atlas:book-seal', [-.200, -.120, .197], [1, 1.30, 1], [0, 0, .12]);

  actor.root.updateMatrixWorld(true);

  return Object.freeze({
    id: ARCANIST_ATLAS_STUDY_ID,
    stage: ARCANIST_ATLAS_STUDY_STAGE,
    modelingMode: 'runtime-procedural',
    productionReady: false,
    meshCount: state.meshes.length,
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      for (const mesh of state.meshes) mesh.removeFromParent();
      for (const geometry of state.geometries) geometry.dispose();
      for (const material of state.materials) material.dispose();
      state.meshes.length = 0;
      state.geometries.clear();
      state.materials.clear();
    }
  });
}
