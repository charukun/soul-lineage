import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Euler,
  Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const freezeRows = rows => Object.freeze(rows.map(row => Object.freeze({ ...row })));
const parts = rows => freezeRows(rows);

export const REFERENCE_ARCHETYPE_PARTS = Object.freeze({
  'npc.child-boy.v1': parts([
    { id: 'child-hooded-cape', mount: 'spine', material: 'cloth' },
    { id: 'child-short-trouser', mount: 'leftUpperLeg', orientTo: 'leftLowerLeg', material: 'cloth' },
    { id: 'child-short-trouser', mount: 'rightUpperLeg', orientTo: 'rightLowerLeg', material: 'cloth' },
    { id: 'small-treasure-pouch', mount: 'spine', material: 'trim' }
  ]),
  'npc.child-girl.v1': parts([
    { id: 'puffed-sleeve', mount: 'leftUpperArm', orientTo: 'leftLowerArm', material: 'cloth' },
    { id: 'puffed-sleeve', mount: 'rightUpperArm', orientTo: 'rightLowerArm', material: 'cloth' },
    { id: 'layered-dress-hem', mount: 'spine', material: 'cloth' },
    { id: 'flower-pouch', mount: 'spine', material: 'trim' }
  ]),
  'npc.elderly-man.v1': parts([
    { id: 'full-white-beard', mount: 'head', material: 'hair' },
    { id: 'fringed-shawl', mount: 'spine', material: 'cloth' },
    { id: 'weathered-pouch', mount: 'spine', material: 'dark' }
  ]),
  'npc.elderly-woman.v1': parts([
    { id: 'apron-hem', mount: 'spine', material: 'cloth' },
    { id: 'herb-pouch', mount: 'spine', material: 'trim' },
    { id: 'gray-hair-wisps', mount: 'head', material: 'hair' }
  ]),
  'npc.guard.v1': parts([
    { id: 'guard-tabard', mount: 'spine', material: 'cloth' },
    { id: 'guard-greave', mount: 'leftLowerLeg', orientTo: 'leftFoot', material: 'metal' },
    { id: 'guard-greave', mount: 'rightLowerLeg', orientTo: 'rightFoot', material: 'metal' },
    { id: 'village-emblem', mount: 'spine', material: 'trim' }
  ]),
  'npc.knight.v1': parts([
    { id: 'ceremonial-plate', mount: 'spine', material: 'metal' },
    { id: 'heraldic-cape', mount: 'spine', material: 'cloth' },
    { id: 'knight-crest', mount: 'spine', material: 'trim' }
  ]),
  'npc.blacksmith.v1': parts([
    { id: 'heavy-work-glove', mount: 'leftHand', material: 'dark' },
    { id: 'heavy-work-glove', mount: 'rightHand', material: 'dark' },
    { id: 'tool-belt', mount: 'spine', material: 'trim' }
  ]),
  'npc.laborer.v1': parts([
    { id: 'rolled-work-cuff', mount: 'leftUpperArm', orientTo: 'leftLowerArm', material: 'cloth' },
    { id: 'rolled-work-cuff', mount: 'rightUpperArm', orientTo: 'rightLowerArm', material: 'cloth' },
    { id: 'patched-trouser', mount: 'leftUpperLeg', orientTo: 'leftLowerLeg', material: 'cloth' },
    { id: 'patched-trouser', mount: 'rightUpperLeg', orientTo: 'rightLowerLeg', material: 'cloth' },
    { id: 'work-towel', mount: 'spine', material: 'cloth' }
  ]),
  'npc.hunter.v1': parts([
    { id: 'asymmetric-field-cloak', mount: 'spine', material: 'cloth' },
    { id: 'hunter-satchel', mount: 'spine', material: 'dark' },
    { id: 'boot-gaiter', mount: 'leftLowerLeg', orientTo: 'leftFoot', material: 'cloth' },
    { id: 'boot-gaiter', mount: 'rightLowerLeg', orientTo: 'rightFoot', material: 'cloth' }
  ]),
  'npc.arcanist.v1': parts([
    { id: 'scroll-tubes', mount: 'spine', material: 'trim' },
    { id: 'scholar-satchel', mount: 'spine', material: 'dark' }
  ])
});

export const REFERENCE_DETAIL_IDS = Object.freeze(
  [...new Set(Object.values(REFERENCE_ARCHETYPE_PARTS).flatMap(rows => rows.map(row => row.id)))].sort()
);
export const REFERENCE_DETAIL_MATERIALS = Object.freeze(['cloth', 'trim', 'dark', 'metal', 'hair']);

export function referenceArchetypePartSpecs(id) {
  return REFERENCE_ARCHETYPE_PARTS[id] ?? Object.freeze([]);
}

function transform(geometry, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  geometry.applyMatrix4(new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale)
  ));
  return geometry;
}
function merged(parts) {
  const input = parts.map(geometry => {
    const item = geometry.index ? geometry.toNonIndexed() : geometry;
    for (const key of Object.keys(item.attributes)) if (!['position', 'normal'].includes(key)) item.deleteAttribute(key);
    return item;
  });
  const result = mergeGeometries(input, false);
  new Set([...input, ...parts]).forEach(geometry => geometry.dispose());
  if (!result) throw new Error('Reference detail geometry merge failed');
  result.computeBoundingSphere();
  return result;
}
const ellipsoid = (position, scale, segments = 12) =>
  transform(new SphereGeometry(1, segments, 8), position, scale);
const cylinder = (position, radiusTop, radiusBottom, height, rotation = [0, 0, 0], segments = 10) =>
  transform(new CylinderGeometry(radiusTop, radiusBottom, height, segments), position, [1, 1, 1], rotation);
const box = (position, scale, rotation = [0, 0, 0]) =>
  transform(new BoxGeometry(1, 1, 1), position, scale, rotation);
const ring = (position, radius, thickness, scale = [1, 1, 1], rotation = [Math.PI / 2, 0, 0]) =>
  transform(new TorusGeometry(radius, thickness, 5, 16), position, scale, rotation);

function panel(rows, depth = 0.17, skew = 0) {
  const positions = [], indices = [];
  rows.forEach(([y, width, z = depth], row) => {
    for (let i = 0; i < 7; i++) {
      const t = i / 6 * 2 - 1, x = t * width;
      positions.push(x + skew * (1 - row / Math.max(1, rows.length - 1)), y, z + .026 * (1 - t * t));
    }
  });
  for (let row = 0; row < rows.length - 1; row++) for (let i = 0; i < 6; i++) {
    const a = row * 7 + i, b = a + 7;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function segmentShell(length, radius, taper = .88) {
  return cylinder([0, -length * .5, 0], radius * taper, radius, length, [0, 0, 0], 12);
}
function tassels(y, width, z, count = 7, length = .06) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = (i / Math.max(1, count - 1) * 2 - 1) * width;
    out.push(cylinder([x, y - length * .5, z], .006, .004, length, [0, 0, 0], 6));
  }
  return out;
}
function petal(position, rotation = 0) {
  return ellipsoid(position, [.026, .013, .008], 8).rotateZ(rotation);
}

export function referenceDetailGeometry(id) {
  switch (id) {
    case 'child-hooded-cape':
      return merged([
        panel([[.34, .13, -.13], [.23, .20, -.16], [.04, .25, -.18], [-.23, .28, -.18]], -.17),
        transform(new TorusGeometry(.095, .032, 7, 18, Math.PI * 1.55), [0, .37, -.035], [1, 1.12, 1], [Math.PI / 2, 0, .70])
      ]);
    case 'child-short-trouser':
      return merged([segmentShell(.16, .085, .92), ring([0, -.15, 0], .073, .010)]);
    case 'small-treasure-pouch':
      return merged([ellipsoid([.16, -.10, .16], [.065, .08, .032]), box([.16, -.02, .16], [.075, .020, .035])]);
    case 'puffed-sleeve':
      return merged([ellipsoid([0, -.08, 0], [.10, .11, .10]), ring([0, -.17, 0], .066, .011)]);
    case 'layered-dress-hem':
      return merged([
        panel([[-.10, .19, .16], [-.27, .25, .18], [-.48, .32, .19]]),
        panel([[-.28, .24, .176], [-.43, .30, .195], [-.58, .36, .205]])
      ]);
    case 'flower-pouch': {
      const center = [.18, -.08, .17], details = [ellipsoid(center, [.068, .075, .03]), ellipsoid([.18, -.03, .205], [.025, .025, .012], 8)];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        details.push(petal([.18 + Math.cos(a) * .035, -.03 + Math.sin(a) * .035, .207], a));
      }
      details.push(box([.01, .14, .16], [.016, .44, .010], [0, 0, -.48]));
      return merged(details);
    }
    case 'full-white-beard':
      return merged([
        ellipsoid([0, -.012, .103], [.082, .052, .038]),
        cylinder([0, -.093, .105], .020, .057, .18, [0, 0, 0], 10),
        cylinder([-.043, -.085, .096], .010, .030, .14, [0, 0, -.16], 8),
        cylinder([.043, -.085, .096], .010, .030, .14, [0, 0, .16], 8)
      ]);
    case 'fringed-shawl':
      return merged([
        panel([[.33, .22, .145], [.23, .28, .16], [.09, .31, .17], [-.02, .27, .17]]),
        ...tassels(-.02, .24, .18, 9, .075)
      ]);
    case 'weathered-pouch':
      return merged([ellipsoid([-.18, -.09, .15], [.075, .09, .035]), box([-.18, -.005, .15], [.085, .025, .04])]);
    case 'apron-hem':
      return merged([panel([[.10, .13, .18], [-.12, .20, .19], [-.38, .25, .20], [-.55, .27, .20]])]);
    case 'herb-pouch':
      return merged([
        ellipsoid([.18, -.07, .16], [.075, .085, .035]),
        box([.18, .01, .16], [.082, .022, .04]),
        cylinder([.15, .045, .17], .008, .005, .09, [0, 0, -.25], 6),
        cylinder([.19, .055, .17], .008, .005, .11, [0, 0, .12], 6),
        cylinder([.22, .04, .17], .008, .005, .08, [0, 0, .30], 6)
      ]);
    case 'gray-hair-wisps':
      return merged([
        cylinder([-.095, .02, .025], .004, .010, .16, [0, 0, -.25], 6),
        cylinder([.095, .02, .025], .004, .010, .16, [0, 0, .25], 6),
        cylinder([-.075, .00, -.015], .003, .008, .18, [0, 0, -.18], 6),
        cylinder([.075, .00, -.015], .003, .008, .18, [0, 0, .18], 6)
      ]);
    case 'guard-tabard':
      return merged([
        panel([[.30, .12, .165], [.16, .14, .18], [-.08, .15, .18], [-.38, .17, .19]]),
        panel([[.30, .12, -.15], [.16, .14, -.17], [-.08, .15, -.18], [-.34, .17, -.18]], -.17)
      ]);
    case 'guard-greave':
      return merged([segmentShell(.25, .068, .84), ring([0, -.22, 0], .056, .008)]);
    case 'village-emblem':
      return merged([
        transform(new CylinderGeometry(.052, .052, .012, 6), [0, .17, .205], [1, 1, 1], [Math.PI / 2, 0, 0]),
        box([0, .17, .215], [.012, .075, .009], [0, 0, .78]),
        box([0, .17, .215], [.012, .075, .009], [0, 0, -.78])
      ]);
    case 'ceremonial-plate':
      return merged([
        panel([[.30, .15, .15], [.18, .20, .17], [.02, .19, .17], [-.12, .16, .16]]),
        ellipsoid([-.24, .27, -.005], [.12, .075, .12]),
        ellipsoid([.24, .27, -.005], [.12, .075, .12]),
        ring([0, -.03, 0], .18, .018, [1, 1, .85])
      ]);
    case 'heraldic-cape':
      return merged([panel([[.34, .20, -.16], [.16, .28, -.19], [-.18, .34, -.20], [-.52, .39, -.21], [-.72, .32, -.20]], -.19)]);
    case 'knight-crest':
      return merged([
        transform(new ConeGeometry(.055, .14, 5), [0, .30, .205], [1, 1, .45], [0, 0, 0]),
        box([0, .20, .212], [.020, .10, .010])
      ]);
    case 'heavy-work-glove':
      return merged([ellipsoid([0, -.025, 0], [.075, .09, .065]), ring([0, .045, 0], .061, .012)]);
    case 'tool-belt':
      return merged([
        ring([0, -.03, 0], .177, .013, [1, 1, .84]),
        ellipsoid([.16, -.075, .15], [.055, .065, .028]),
        box([-.15, -.06, .15], [.040, .10, .025], [0, 0, -.10]),
        cylinder([-.19, -.05, .15], .008, .010, .18, [0, 0, -.12], 6)
      ]);
    case 'rolled-work-cuff':
      return merged([ring([0, -.14, 0], .075, .020), cylinder([0, -.09, 0], .073, .082, .10)]);
    case 'patched-trouser':
      return merged([segmentShell(.26, .090, .86), box([.055, -.12, .078], [.045, .07, .008], [0, 0, .12])]);
    case 'work-towel':
      return merged([box([-.16, -.16, .15], [.075, .27, .018], [0, 0, -.08]), ring([-.16, -.01, .04], .045, .008, [1, 1, .65])]);
    case 'asymmetric-field-cloak':
      return merged([panel([[.33, .15, -.145], [.18, .23, -.17], [-.05, .31, -.19], [-.37, .36, -.20], [-.56, .25, -.19]], -.18, .08)]);
    case 'hunter-satchel':
      return merged([ellipsoid([.19, -.09, -.18], [.078, .10, .042]), box([.03, .12, -.17], [.016, .46, .012], [0, 0, .45])]);
    case 'boot-gaiter':
      return merged([segmentShell(.24, .074, .91), ring([0, -.21, 0], .061, .009)]);
    case 'scroll-tubes':
      return merged([
        cylinder([.14, .06, -.18], .030, .030, .32, [0, 0, -.18], 10),
        cylinder([.20, .08, -.17], .027, .027, .28, [0, 0, .08], 10),
        ring([.14, .20, -.18], .028, .006, [1, 1, 1], [Math.PI / 2, 0, -.18]),
        ring([.20, .215, -.17], .025, .006, [1, 1, 1], [Math.PI / 2, 0, .08])
      ]);
    case 'scholar-satchel':
      return merged([
        ellipsoid([-.19, -.08, -.18], [.09, .11, .044]),
        box([-.19, .025, -.18], [.10, .026, .05]),
        box([-.02, .13, -.17], [.016, .49, .012], [0, 0, -.48])
      ]);
    default:
      throw new Error(`Unknown reference detail geometry: ${id}`);
  }
}
