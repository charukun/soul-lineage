import { Group, Mesh, MeshStandardMaterial, DoubleSide } from 'three';
import { leaseWardrobeGeometry, outfitGeometry } from '@soul/rendering/master-character-wardrobe';

// Golden Base uses the same catalog and cached garment geometry as the modular
// character view. Its torso bone drives the garment shell, matching the existing
// modular controller; the garment itself is rigid rather than skinned cloth.
const OUTFITS = new Set(['uniform', 'tunic', 'mantle', 'apron']);
export function attachGoldenBaseWardrobe(root) {
  if (!root?.isObject3D) throw new TypeError('Golden Base root is required');
  const spine = root.getObjectByName('spine');
  if (!spine?.isBone) throw new TypeError('Golden Base spine bone is required');
  const group = new Group();
  group.name = 'golden-base-wardrobe';
  group.position.set(0, -.05, 0);
  group.scale.set(2.2, 1.2, 2.2);
  spine.add(group);
  const cloth = new MeshStandardMaterial({ color: '#637b70', roughness: .91, side: DoubleSide });
  const trim = new MeshStandardMaterial({ color: '#b89c69', roughness: .84, side: DoubleSide });
  let current = 'uniform', parts = [], disposed = false;
  function clear() {
    for (const { mesh, lease } of parts) { mesh.removeFromParent(); lease.release(); }
    parts = [];
  }
  return {
    get outfit() { return current; },
    setOutfit(outfit) {
      if (disposed) throw new Error('Golden Base wardrobe has been disposed');
      if (!OUTFITS.has(outfit)) throw new TypeError('Unsupported Golden Base outfit');
      if (outfit === current) return;
      clear();
      current = outfit;
      if (outfit === 'uniform') return;
      for (const isTrim of [false, true]) {
        const lease = leaseWardrobeGeometry(`outfit-v2:${outfit}:${isTrim}`, () => outfitGeometry(outfit, isTrim));
        const mesh = new Mesh(lease.geometry, isTrim ? trim : cloth);
        mesh.name = `golden-outfit:${outfit}:${isTrim ? 'trim' : 'cloth'}`;
        group.add(mesh);
        parts.push({ mesh, lease });
      }
    },
    dispose() {
      if (disposed) return;
      clear();
      group.removeFromParent();
      cloth.dispose();
      trim.dispose();
      disposed = true;
    }
  };
}
