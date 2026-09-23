import {createReferenceChibi} from '../../../packages/assets/src/procedural-character/create-reference-chibi.js';

const reference = new URL('../../../packages/assets/characters/reference-chibi/chibi-front.jpg', import.meta.url).href;
export const referenceChibiCandidate = {
  type: 'procedural',
  manifest: {
    id: 'reference-chibi-front-20260923', displayName: '正面図チビキャラ',
    reconstructionMode: 'single-view', reviewStatus: 'review-candidate', animations: [],
    bounds: {min: [-1.03, 0, -.48], max: [1.03, 2.8, .48]},
    presentation: {groundPoint: [0,0,0], headAnchor: [0,2.35,0], bodyCenter: [0,1.35,0], focusTarget: [0,1.55,0]},
    provenance: {source: 'User-provided front view, 2026-09-23', rights: 'Review candidate; rights not independently verified'},
  },
  references: {front: reference}, sourceReferences: {front: reference},
  report: {
    method: 'img2threejs character reconstruction: reference analysis, measured proportions, procedural Three.js component hierarchy',
    observed: ['front silhouette', '2.7 head-unit proportions', 'eye colour and makeup', 'grey sleeveless suit', 'neutral arm pose'],
    inferred: ['side and rear head volume', 'body depth', 'back of garment', 'unseen facial geometry'],
    limitations: ['Single front image: side/back likeness cannot be verified', 'No skinning or production animation', 'Review candidate only; no gameplay promotion'],
  },
};

export function createReferenceChibiActor(THREE, manifest) {
  const root = createReferenceChibi(THREE), helper = new THREE.Group();
  const materials = new Set(), meshes = [];
  root.traverse(node => { if (node.isMesh) { meshes.push(node); materials.add(node.material); } });
  let paused = false, time = 0, action = 'Bind';
  const cameraSubject = () => ({
    id: manifest.id, position: {x:0,y:0,z:0}, yaw: root.rotation.y,
    height: 2.8, radius: 1.03, focusHeight: 1.55, weaponRadius: 0,
    bounds: manifest.bounds,
    headAnchor: {x:0,y:2.35,z:0}, bodyCenter: {x:0,y:1.35,z:0},
    focusTarget: {x:0,y:1.55,z:0}, groundPoint: {x:0,y:0,z:0},
  });
  return {
    root, helper, manifest, get action() { return action; },
    play(name) { if(name !== 'Idle') throw new Error('Animation not available'); action=name; },
    neutral() { action='Bind'; time=0; root.rotation.y=0; root.userData.headPivot.rotation.z=0; },
    setPaused(value) { paused=Boolean(value); },
    update(dt) { if (!paused && action === 'Idle') { time+=dt; root.userData.headPivot.rotation.z=Math.sin(time*1.7)*.012; } },
    setEquipment() {},
    setDisplay({wireframe=false}) { for(const m of materials) m.wireframe=wireframe; },
    cameraSubject,
    snapshot() { return {id:manifest.id,action,time,representation:'procedural-3d',inferred:root.userData.inferred}; },
    dispose() {
      root.removeFromParent(); helper.removeFromParent();
      for (const mesh of meshes) mesh.geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
