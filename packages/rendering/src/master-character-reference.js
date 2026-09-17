import {
  BoxGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh,
  MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { gearGeometry, hairGeometry, outfitGeometry } from './master-character-wardrobe.js';

const UP = new Vector3(0, 1, 0);
const REFERENCE_KEY = Symbol('master-character-reference-runtime');

function material(name, roughness = .82, metalness = 0) {
  return new MeshStandardMaterial({ name, roughness, metalness, side: DoubleSide });
}

function setColor(mat, rgb) {
  mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
}

function addMesh(state, parent, geometry, mat, name, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  if (!parent || !geometry) return null;
  const mesh = new Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  parent.add(mesh);
  state.created.push(mesh);
  return mesh;
}

function addGroup(state, parent, name) {
  if (!parent) return null;
  const group = new Group();
  group.name = name;
  parent.add(group);
  state.created.push(group);
  return group;
}

function addSegment(state, bones, from, to, radius, mat, name, radiusZ = radius) {
  const a = bones[from], b = bones[to];
  if (!a || !b) return null;
  const delta = b.position.clone();
  const length = delta.length();
  if (!Number.isFinite(length) || length < .015) return null;
  const mesh = addMesh(state, a, new CylinderGeometry(1, 1, 1, 10, 1, false), mat, name);
  mesh.position.copy(delta).multiplyScalar(.5);
  mesh.scale.set(radius, length, radiusZ);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, delta.clone().normalize()));
  return mesh;
}

function paletteMaterials(materials, style) {
  const p = style.palette;
  for (const key of ['skin','hair','eyes','primary','secondary','accent','dark','metal','leather','wood']) setColor(materials[key], p[key]);
}

function addHumanoid(state, actor, style, materials) {
  const b = actor.bones;
  const compact = style.scale < .72;
  const broad = ['guard','knight','blacksmith','laborer'].includes(style.design);
  const torsoX = broad ? .185 : compact ? .155 : .17;
  const torsoY = compact ? .22 : .255;
  const torsoZ = broad ? .135 : .12;

  addMesh(state, b.spine, new SphereGeometry(1, 18, 12), materials.secondary, 'reference:torso', [0, .03, 0], [torsoX, torsoY, torsoZ]);
  addMesh(state, b.hips, new SphereGeometry(1, 16, 10), materials.dark, 'reference:pelvis', [0, .055, 0], [torsoX * .93, compact ? .11 : .13, torsoZ * .96]);

  const headScale = compact ? [.115,.132,.105] : [.11,.128,.102];
  addMesh(state, b.head, new SphereGeometry(1, 20, 14), materials.skin, 'reference:head', [0, .078, .008], headScale);
  for (const x of [-.038, .038]) {
    addMesh(state, b.head, new SphereGeometry(1, 10, 7), materials.eyes, `reference:eye:${x < 0 ? 'l' : 'r'}`, [x, .087, .097], [.019,.024,.008]);
    addMesh(state, b.head, new SphereGeometry(1, 8, 6), materials.dark, `reference:pupil:${x < 0 ? 'l' : 'r'}`, [x, .086, .103], [.008,.012,.004]);
  }
  addMesh(state, b.head, new BoxGeometry(1,1,1), materials.accent, 'reference:mouth', [0,.038,.101], [.028,.004,.004]);

  const hair = hairGeometry(style.hairFamily, style.hairFront, style.hairBack);
  addMesh(state, b.head, hair, materials.hair, 'reference:hair');
  if (style.hairExtra === 'bun') addMesh(state, b.head, new SphereGeometry(1,14,10), materials.hair, 'reference:hair-bun', [0,.135,-.12], [.068,.062,.055]);
  if (style.prop === 'ribbon') {
    addMesh(state, b.head, new BoxGeometry(1,1,1), materials.accent, 'reference:ribbon-left', [-.072,.148,-.05], [.045,.025,.009], [0,0,.48]);
    addMesh(state, b.head, new BoxGeometry(1,1,1), materials.accent, 'reference:ribbon-right', [-.112,.148,-.05], [.045,.025,.009], [0,0,-.48]);
  }

  const upperArmMat = style.armStyle === 'armor' ? materials.metal : materials.secondary;
  const lowerArmMat = style.armStyle === 'rolled' ? materials.skin : style.armStyle === 'armor' ? materials.metal : materials.secondary;
  addSegment(state,b,'leftUpperArm','leftLowerArm', broad ? .047 : .041,upperArmMat,'reference:left-upper-arm');
  addSegment(state,b,'rightUpperArm','rightLowerArm',broad ? .047 : .041,upperArmMat,'reference:right-upper-arm');
  addSegment(state,b,'leftLowerArm','leftHand',.037,lowerArmMat,'reference:left-lower-arm');
  addSegment(state,b,'rightLowerArm','rightHand',.037,lowerArmMat,'reference:right-lower-arm');
  for (const [side,bone] of [['left',b.leftHand],['right',b.rightHand]]) {
    const handMat = style.armStyle === 'armor' ? materials.dark : materials.skin;
    addMesh(state,bone,new SphereGeometry(1,10,8),handMat,`reference:${side}-hand`,[0,.018,0],[.043,.055,.03]);
  }

  const legMat = style.legStyle === 'bare' ? materials.skin : style.legStyle === 'armor' ? materials.metal : materials.dark;
  addSegment(state,b,'leftUpperLeg','leftLowerLeg',broad?.065:.058,legMat,'reference:left-thigh',broad?.06:.053);
  addSegment(state,b,'rightUpperLeg','rightLowerLeg',broad?.065:.058,legMat,'reference:right-thigh',broad?.06:.053);
  addSegment(state,b,'leftLowerLeg','leftFoot',style.legStyle==='armor'?.057:.05,legMat,'reference:left-calf',.047);
  addSegment(state,b,'rightLowerLeg','rightFoot',style.legStyle==='armor'?.057:.05,legMat,'reference:right-calf',.047);
  const footMat = style.footwear === 'greaves' ? materials.metal : materials.leather;
  for (const [side,bone] of [['left',b.leftFoot],['right',b.rightFoot]]) addMesh(state,bone,new BoxGeometry(1,1,1),footMat,`reference:${side}-foot`,[0,.015,.045],[.065,.055,.12]);
}

function addWardrobe(state, actor, style, materials) {
  const spine = actor.bones.spine;
  if (!spine) return;
  const design = style.design;
  const outfit = design === 'blacksmith' || design === 'laborer' ? 'apron' : ['knight','arcanist','elderly-man','elderly-woman'].includes(design) ? 'mantle' : 'tunic';
  const body = outfitGeometry(outfit, false), trim = outfitGeometry(outfit, true);
  const bodyMesh = addMesh(state,spine,body,materials.primary,`reference:${design}:outfit`);
  addMesh(state,spine,trim,materials.accent,`reference:${design}:trim`);

  if (design === 'shino') {
    bodyMesh.scale.y = .55; bodyMesh.position.y = .12;
    const cape = outfitGeometry('mantle', false), capeTrim = outfitGeometry('mantle', true);
    const capeMesh = addMesh(state,spine,cape,materials.primary,'reference:shino:capelet',[0,.16,0],[1,.42,1]);
    capeMesh.scale.x = .88; capeMesh.scale.z = .90;
    addMesh(state,spine,capeTrim,materials.accent,'reference:shino:capelet-trim',[0,.16,0],[.90,.42,.92]);
    addMesh(state,spine,new TorusGeometry(.17,.012,6,22),materials.leather,'reference:shino:belt',[0,-.035,0],[1,1,.80],[Math.PI/2,0,0]);
    addGear(state,spine,'satchel',materials.leather,materials.metal,'reference:shino:satchel');
  }

  if (['guard','knight'].includes(design)) addGear(state,spine,'armor',materials.secondary,materials.metal,`reference:${design}:armor`);
  if (design === 'hunter') { addGear(state,spine,'quiver',materials.leather,materials.metal,'reference:hunter:quiver'); addGear(state,spine,'satchel',materials.leather,materials.metal,'reference:hunter:satchel'); }
  if (design === 'blacksmith') addGear(state,spine,'tools',materials.leather,materials.metal,'reference:blacksmith:tools');
  if (design === 'laborer') { addGear(state,spine,'tools',materials.leather,materials.metal,'reference:laborer:tools'); addGear(state,spine,'pack',materials.leather,materials.metal,'reference:laborer:pack'); }
  if (design === 'elderly-man' || design === 'elderly-woman') addGear(state,spine,'shawl',materials.secondary,materials.metal,`reference:${design}:shawl`);
  if (design === 'arcanist') addGear(state,spine,'cowl',materials.secondary,materials.metal,'reference:arcanist:cowl');

  if (design === 'child-girl' || design === 'elderly-woman' || design === 'arcanist') {
    addMesh(state,spine,new CylinderGeometry(.20,.25,.48,16,1,true),materials.primary,`reference:${design}:skirt`,[0,-.28,0]);
  }
  if (design === 'knight') {
    const cape = outfitGeometry('mantle', false);
    addMesh(state,spine,cape,materials.secondary,'reference:knight:cape',[0,.02,-.045],[1.06,1.02,1.04]);
  }
}

function addGear(state, parent, gear, softMaterial, metalMaterial, prefix) {
  const soft = gearGeometry(gear, false), metal = gearGeometry(gear, true);
  if (soft) addMesh(state,parent,soft,softMaterial,`${prefix}:soft`);
  if (metal) addMesh(state,parent,metal,metalMaterial,`${prefix}:metal`);
}

function addProps(state, actor, style, materials) {
  const spine = actor.bones.spine, head = actor.bones.head;
  if (!spine) return;
  const prop = style.prop;
  if (prop === 'spear') {
    addMesh(state,spine,new CylinderGeometry(.008,.008,1.55,8),materials.wood,'reference:prop:spear-shaft',[.30,-.18,.03]);
    addMesh(state,spine,new ConeGeometry(.038,.15,8),materials.metal,'reference:prop:spear-tip',[.30,.67,.03]);
  } else if (prop === 'sword') {
    addMesh(state,spine,new BoxGeometry(1,1,1),materials.metal,'reference:prop:sword-blade',[.27,-.22,.075],[.032,.43,.012],[0,0,-.16]);
    addMesh(state,spine,new BoxGeometry(1,1,1),materials.accent,'reference:prop:sword-guard',[.20,.19,.075],[.13,.018,.025],[0,0,-.16]);
    addMesh(state,spine,new CylinderGeometry(.018,.018,.15,8),materials.leather,'reference:prop:sword-grip',[.19,.28,.075],[1,1,1],[0,0,-.16]);
  } else if (prop === 'bow') {
    addMesh(state,spine,new TorusGeometry(.29,.009,6,30,Math.PI*1.52),materials.wood,'reference:prop:bow',[.12,.04,-.17],[1,1.38,1],[0,0,-.76]);
    addMesh(state,spine,new CylinderGeometry(.002,.002,.58,4),materials.secondary,'reference:prop:bow-string',[.10,.03,-.17],[1,1,1],[0,0,-.14]);
  } else if (prop === 'hammer') {
    addMesh(state,spine,new CylinderGeometry(.013,.016,.48,8),materials.wood,'reference:prop:hammer-handle',[.23,-.16,.13],[1,1,1],[0,0,-.28]);
    addMesh(state,spine,new BoxGeometry(1,1,1),materials.metal,'reference:prop:hammer-head',[.17,.06,.13],[.15,.065,.07],[0,0,-.28]);
  } else if (prop === 'cane') {
    addMesh(state,spine,new CylinderGeometry(.011,.014,1.02,8),materials.wood,'reference:prop:cane',[.24,-.24,.08],[1,1,1],[0,0,-.06]);
    addMesh(state,spine,new TorusGeometry(.055,.011,6,16,Math.PI*1.15),materials.wood,'reference:prop:cane-handle',[.205,.29,.08],[1,1,1],[0,0,.55]);
  } else if (prop === 'basket') {
    addMesh(state,spine,new CylinderGeometry(.11,.09,.19,12),materials.wood,'reference:prop:basket',[-.24,-.19,.08]);
    addMesh(state,spine,new TorusGeometry(.10,.012,6,18,Math.PI),materials.leather,'reference:prop:basket-handle',[-.24,-.05,.08],[1,1.2,1],[0,0,0]);
  } else if (prop === 'toolbelt') {
    addMesh(state,spine,new TorusGeometry(.175,.012,6,22),materials.leather,'reference:prop:toolbelt',[0,-.04,0],[1,1,.82],[Math.PI/2,0,0]);
    for (const x of [-.18,.18]) addMesh(state,spine,new BoxGeometry(1,1,1),materials.leather,`reference:prop:pouch:${x}`,[x,-.12,.14],[.065,.08,.035]);
  } else if (prop === 'staff-book') {
    addMesh(state,spine,new CylinderGeometry(.009,.013,1.42,8),materials.wood,'reference:prop:staff',[.29,-.11,.02]);
    addMesh(state,spine,new SphereGeometry(1,12,8),materials.accent,'reference:prop:staff-gem',[.29,.64,.02],[.055,.055,.055]);
    addMesh(state,spine,new BoxGeometry(1,1,1),materials.leather,'reference:prop:book',[-.20,-.12,.15],[.10,.14,.035],[0,0,.12]);
    addMesh(state,spine,new BoxGeometry(1,1,1),materials.accent,'reference:prop:book-clasp',[-.20,-.12,.188],[.018,.14,.008],[0,0,.12]);
  } else if (prop === 'satchel') {
    addGear(state,spine,'satchel',materials.leather,materials.metal,'reference:prop:satchel');
  }
  if (style.design === 'arcanist' && head) {
    addMesh(state,head,new TorusGeometry(.035,.0045,5,16),materials.metal,'reference:arcanist:glasses-l',[-.046,.087,.101],[1,.76,1]);
    addMesh(state,head,new TorusGeometry(.035,.0045,5,16),materials.metal,'reference:arcanist:glasses-r',[.046,.087,.101],[1,.76,1]);
  }
}

function removeCreated(state) {
  const geometries = new Set();
  for (const object of state.created) {
    if (object.isMesh && object.geometry) geometries.add(object.geometry);
    object.removeFromParent();
  }
  state.created.length = 0;
  for (const geometry of geometries) geometry.dispose();
}

/**
 * Builds a reference-sheet-specific runtime model on the audited humanoid rig.
 * Source meshes are hidden, not destroyed, so returning to generated Shino is lossless.
 */
export function attachReferenceCharacterController(actor) {
  if (actor[REFERENCE_KEY]) return actor[REFERENCE_KEY];
  const state = { created: [], activeId: null, activeStyle: null };
  const hiddenMeshes = new Map();
  const materials = {
    skin: material('REF_SKIN',.88), hair: material('REF_HAIR',.72), eyes: material('REF_EYES',.55),
    primary: material('REF_PRIMARY',.90), secondary: material('REF_SECONDARY',.88), accent: material('REF_ACCENT',.82),
    dark: material('REF_DARK',.80), metal: material('REF_METAL',.38,.58), leather: material('REF_LEATHER',.76), wood: material('REF_WOOD',.84)
  };

  function hideRuntimeBase() {
    actor.visual.traverse(node => {
      if (!node.isMesh || node.name.startsWith('reference:')) return;
      if (!hiddenMeshes.has(node)) hiddenMeshes.set(node, node.visible);
      node.visible = false;
    });
  }
  function restoreRuntimeBase() {
    for (const [node, visible] of hiddenMeshes) node.visible = visible;
    hiddenMeshes.clear();
  }
  function clear() { removeCreated(state); state.activeId = null; state.activeStyle = null; }
  function setIdentity(identity) {
    const style = identity?.referenceStyle;
    if (!style) { clear(); restoreRuntimeBase(); return; }
    hideRuntimeBase();
    paletteMaterials(materials, style);
    if (state.activeId === identity.id) return;
    clear();
    const runtimeStyle = { ...style, hairFamily: identity.parts.hair, hairFront: identity.front, hairBack: identity.back };
    const marker = addGroup(state, actor.visual, `reference-character:${identity.id}`);
    marker.userData.referenceModel = identity.id;
    marker.userData.referencePath = identity.referencePath;
    addHumanoid(state, actor, runtimeStyle, materials);
    addWardrobe(state, actor, runtimeStyle, materials);
    addProps(state, actor, runtimeStyle, materials);
    state.activeId = identity.id;
    state.activeStyle = style;
    actor.root.scale.multiplyScalar(style.scale);
  }
  const sampled = actor.sample.bind(actor);
  actor.sample = (...args) => {
    sampled(...args);
    if (state.activeStyle) actor.root.scale.multiplyScalar(state.activeStyle.scale);
  };
  let destroyed = false;
  const inheritedDestroy = actor.destroy.bind(actor);
  const controller = {
    setIdentity,
    clear,
    diagnostics: () => ({ activeId: state.activeId, meshCount: state.created.filter(x => x.isMesh).length, hiddenBaseMeshes: hiddenMeshes.size }),
    destroy() {
      if (destroyed) return;
      clear(); restoreRuntimeBase(); Object.values(materials).forEach(m => m.dispose()); destroyed = true;
    }
  };
  actor.destroy = () => { controller.destroy(); inheritedDestroy(); };
  actor[REFERENCE_KEY] = controller;
  return controller;
}
