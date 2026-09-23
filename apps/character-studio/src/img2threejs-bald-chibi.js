import * as THREE from 'three';

// img2threejs 6e60b5e: measured blockout -> full-volume structure ->
// de-lit, orthographic-projected facial albedo. +Z is the reference front.
// This is a standalone THREE.Group factory; no KayKit model is involved.
const skin = new THREE.MeshStandardMaterial({ color: '#f6dcdb', roughness: .71 });
const earInner = new THREE.MeshStandardMaterial({ color: '#e8b5b5', roughness: .83 });
const cloth = new THREE.MeshStandardMaterial({ color: '#b9b8bc', roughness: .91, side: THREE.DoubleSide });
const clothTrim = new THREE.MeshStandardMaterial({ color: '#98979c', roughness: .94 });

function ellipsoid(parent, name, xyz, radii, material, detail = 24) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.max(16, detail >> 1)), material);
  mesh.name = name;
  mesh.position.set(...xyz);
  mesh.scale.set(...radii);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tapered(parent, name, from, to, r1, r2, material) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, direction.length(), 18, 1), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  ellipsoid(parent, `${name}-start`, from, [r1, r1, r1], material);
  ellipsoid(parent, `${name}-end`, to, [r2, r2, r2], material);
}

function torsoGeometry() {
  // Closed elliptical rings with measured waist and full front/back depth.
  const rings = [
    [0.84, .22, .20], [.94, .29, .21], [1.10, .31, .23],
    [1.25, .26, .20], [1.39, .205, .175], [1.58, .245, .205],
    [1.69, .16, .145]
  ];
  const positions = [], indices = [], sides = 32;
  for (const [y, rx, rz] of rings) for (let i = 0; i < sides; i++) {
    const angle = 2 * Math.PI * i / sides;
    positions.push(rx * Math.cos(angle), y, rz * Math.sin(angle));
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
    const a = j * sides + i, b = j * sides + (i + 1) % sides;
    indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  // Close the hip and neck so the back and underside also exist.
  positions.push(0, rings[0][0], 0, 0, rings.at(-1)[0], 0);
  const bottom = rings.length * sides, top = bottom + 1;
  for (let i = 0; i < sides; i++) {
    indices.push(bottom, i, (i + 1) % sides);
    const a = (rings.length - 1) * sides + i, b = (rings.length - 1) * sides + (i + 1) % sides;
    indices.push(top, b, a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export async function createImg2ThreeReferenceCharacter({ textureUrl = '/img2threejs-bald-chibi/head-uv.png' } = {}) {
  const root = new THREE.Group();
  root.name = 'img2threejs-reference-bald-chibi';
  const headTexture = await new THREE.TextureLoader().loadAsync(textureUrl);
  headTexture.colorSpace = THREE.SRGBColorSpace;
  headTexture.anisotropy = 4;
  const headMaterial = new THREE.MeshStandardMaterial({ map: headTexture, roughness: .83 });

  const body = new THREE.Mesh(torsoGeometry(), cloth);
  body.name = 'closed-volume-grey-suit';
  body.castShadow = true;
  root.add(body);
  ellipsoid(root, 'neck-collar', [0, 1.67, 0], [.16, .075, .15], clothTrim);
  ellipsoid(root, 'neck', [0, 1.735, 0], [.125, .11, .13], skin);
  const head = ellipsoid(root, 'full-depth-projected-head', [0, 2.18, 0], [.485, .505, .39], headMaterial, 64);
  head.userData.depthRatio = .39 / .485;
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right';
    ellipsoid(root, `${side}-ear`, [sign * .486, 2.03, -.025], [.095, .115, .083], skin);
    ellipsoid(root, `${side}-ear-concha`, [sign * .544, 2.04, .052], [.04, .064, .014], earInner);

    // T pose: separate upper arm, elbow, forearm, palm and three small fingers.
    tapered(root, `${side}-upper-arm`, [sign * .245, 1.57, 0], [sign * .52, 1.48, 0], .125, .094, skin);
    tapered(root, `${side}-forearm`, [sign * .52, 1.48, 0], [sign * .79, 1.44, 0], .092, .057, skin);
    ellipsoid(root, `${side}-palm`, [sign * .86, 1.435, .005], [.093, .041, .060], skin);
    for (let finger = 0; finger < 3; finger++) ellipsoid(root, `${side}-finger-${finger}`, [sign * (.938 + (finger === 1 ? .015 : 0)), 1.424, (finger - 1) * .028], [.043, .019, .018], skin, 16);
    ellipsoid(root, `${side}-thumb`, [sign * .835, 1.401, .085], [.047, .025, .024], skin, 16);
    const hip = sign * .155;
    ellipsoid(root, `${side}-shorts-hem`, [hip, .88, 0], [.151, .105, .187], cloth);
    tapered(root, `${side}-thigh`, [hip, .85, 0], [sign * .185, .51, .018], .144, .109, skin);
    tapered(root, `${side}-calf`, [sign * .185, .51, .018], [sign * .185, .16, .027], .109, .069, skin);
    ellipsoid(root, `${side}-foot`, [sign * .185, .084, .088], [.105, .075, .173], skin);
    for (let toe = 0; toe < 4; toe++) ellipsoid(root, `${side}-toe-${toe}`, [sign * (.125 + toe * .038), .048, .225], [.023, .03, .052], skin, 12);
  }
  root.userData.img2threejs = {
    revision: '6e60b5e22419464b4853e01ddb6c0e6f6659a733',
    visibleReference: '1024×1536 single frontal image',
    inferredRegions: ['left profile', 'right profile', 'back', 'head depth', 'body depth'],
    measuredHeadUnits: 2.68,
    fullVolume: true
  };
  return root;
}
