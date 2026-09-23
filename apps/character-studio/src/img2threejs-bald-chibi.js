import * as THREE from 'three';

// img2threejs 6e60b5e: measured blockout -> full-volume structure ->
// de-lit, orthographic-projected facial albedo. +Z is the reference front.
// Golden Base retains the photographed face with a rounder, hero-like silhouette.
// This is a standalone THREE.Group factory; no KayKit model is involved.
const skin = new THREE.MeshStandardMaterial({ color: '#f6dcdb', roughness: .71, side: THREE.DoubleSide });
const earInner = new THREE.MeshStandardMaterial({ color: '#efcaca', roughness: .83 });
const cloth = new THREE.MeshStandardMaterial({ color: '#bcb9bf', roughness: .91, side: THREE.DoubleSide });
const clothTrim = new THREE.MeshStandardMaterial({ color: '#b7b5b9', roughness: .94 });

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

function curvedLimb(parent, name, profile, axis, material, depth = 1) {
  const positions=[], indices=[], sides=24, perSpan=6;
  // Cubic interpolation keeps the measured joint landmarks, while rounding
  // the silhouette through upper limb, elbow/knee and distal limb.
  const smooth=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  const ring=(coords,r)=>{
    for(let j=0;j<sides;j++){
      const angle=2*Math.PI*j/sides,u=Math.cos(angle)*r,v=Math.sin(angle)*r;
      positions.push(axis==='x'?coords[0]:coords[0]+u, axis==='x'?coords[1]+u:coords[1], coords[2]+v*depth);
    }
  };
  for(let i=0;i<profile.length-1;i++) for(let step=0;step<perSpan;step++){
    const t=step/perSpan;
    ring([0,1,2].map(k=>smooth(profile[Math.max(0,i-1)][k],profile[i][k],profile[i+1][k],profile[Math.min(profile.length-1,i+2)][k],t)),
      smooth(profile[Math.max(0,i-1)][3],profile[i][3],profile[i+1][3],profile[Math.min(profile.length-1,i+2)][3],t));
  }
  ring(profile.at(-1).slice(0,3),profile.at(-1)[3]);
  const count=positions.length/3/sides;
  for(let k=0;k<count-1;k++)for(let j=0;j<sides;j++){
    const a=k*sides+j,b=k*sides+(j+1)%sides;
    indices.push(a,b,a+sides,b,b+sides,a+sides);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;parent.add(mesh);
}

function torsoGeometry() {
  // Closed near-circular sections round the side profile and widen the
  // shoulders and waist toward the current protagonist's compact physique.
  const guides = [[0.84,.305,.275],[.94,.335,.305],[1.10,.34,.315],[1.25,.29,.275],[1.39,.275,.27],[1.58,.355,.32],[1.69,.245,.235]];
  const rings=[];
  const smooth=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let i=0;i<guides.length-1;i++)for(let k=0;k<5;k++)rings.push([0,1,2].map(n=>smooth(guides[Math.max(0,i-1)][n],guides[i][n],guides[i+1][n],guides[Math.min(guides.length-1,i+2)][n],k/5)));
  rings.push(guides.at(-1));
  const positions = [], indices = [], sides = 32;
  for (let row = 0; row < rings.length; row++) for (let i = 0; i < sides; i++) {
    const [y, rx, rz] = rings[row];
    const angle = 2 * Math.PI * i / sides;
    // Front and rear crotch arches break the otherwise dress-like flat hem.
    const notch = .115 * Math.max(0, 1-row/5) * Math.pow(Math.abs(Math.sin(angle)), 8);
    positions.push(rx * Math.cos(angle), y + notch, rz * Math.sin(angle));
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
    const a = j * sides + i, b = j * sides + (i + 1) % sides;
    indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  // Close the hip and neck so the back and underside also exist.
  positions.push(0, rings[0][0] + .145, 0, 0, rings.at(-1)[0], 0);
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

// One continuous head surface with a fuller cranium, cheeks and rounded jaw.
// The original UV layout keeps the photographed face on the curved mesh.
function chibiHeadGeometry() {
  // normalized height, half-width, half-depth, front/back offset
  const profile = [
    [-1,0,0,.04],[-.88,.42,.45,.055],[-.72,.68,.70,.06],
    [-.52,.88,.86,.055],[-.31,1.065,.98,.03],[-.10,1.055,1.01,0],
    [.18,1.055,1.025,-.015],[.46,.97,1.01,-.04],
    [.70,.78,.82,-.055],[.88,.48,.53,-.05],[1,0,0,-.04]
  ];
  const cubic = (a,b,c,d,t) => .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  const shape = new THREE.SphereGeometry(1,64,40);
  const positions = shape.getAttribute('position');
  for (let i=0; i<positions.count; i++) {
    const y=positions.getY(i), x=positions.getX(i), z=positions.getZ(i);
    const angle=Math.atan2(z,x);
    let k=0;
    while(k<profile.length-2 && y>profile[k+1][0]) k++;
    const t=Math.min(1,Math.max(0,(y-profile[k][0])/(profile[k+1][0]-profile[k][0])));
    const at=field=>cubic(profile[Math.max(0,k-1)][field],profile[k][field],profile[k+1][field],profile[Math.min(profile.length-1,k+2)][field],t);
    const side=Math.cos(angle), front=Math.max(0,Math.sin(angle));
    const cheek=.065*Math.exp(-Math.pow((y+.25)/.27,2))*Math.exp(-Math.pow((Math.abs(side)-.48)/.28,2));
    const nose=.075*Math.exp(-Math.pow((y+.36)/.15,2))*Math.exp(-Math.pow(side/.18,2));
    const chin=.055*Math.exp(-Math.pow((y+.62)/.16,2))*Math.exp(-Math.pow(side/.35,2));
    positions.setXYZ(i,side*at(1),y,at(3)+Math.sin(angle)*at(2)+(cheek+nose+chin)*front);
  }
  positions.needsUpdate=true;
  shape.computeVertexNormals();
  shape.computeBoundingBox();
  return shape;
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
  ellipsoid(root, 'neck-collar', [0, 1.67, 0], [.195, .075, .19], clothTrim);
  ellipsoid(root, 'neck', [0, 1.735, 0], [.13, .105, .14], skin);
  const head = new THREE.Mesh(chibiHeadGeometry(), headMaterial);
  head.name = 'full-depth-projected-head';
  head.position.set(0, 2.2, 0);
  head.scale.set(.45, .47, .455);
  head.castShadow = true; head.receiveShadow = true;
  root.add(head);
  const bounds = head.geometry.boundingBox;
  head.userData.depthRatio = (bounds.max.z-bounds.min.z)*head.scale.z / ((bounds.max.x-bounds.min.x)*head.scale.x);
  // Keep the eyes raised while bringing the small smile off the chin.
  // The lower-face correction fades out before the eyes and at the bottom pole;
  // both blends stay continuous so the original facial texture remains intact.
  const uv = head.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const v = uv.getY(i);
    const faceLift = .15 * Math.sin(Math.PI * v);
    const mouthLift = v < .55 ? .08 * Math.sin(Math.PI * v / .55) ** 2 : 0;
    uv.setY(i, Math.max(0, v - faceLift - mouthLift));
  }
  uv.needsUpdate = true;
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right';
    ellipsoid(root, `${side}-ear`, [sign * .417, 2.025, .018], [.082, .115, .085], skin);
    ellipsoid(root, `${side}-ear-concha`, [sign * .47, 2.025, .087], [.018, .042, .007], earInner);

    // T pose: separate upper arm, elbow, forearm, palm and three small fingers.
    curvedLimb(root, `${side}-whole-arm`, [
      [sign*.33,1.57,0,.137],[sign*.46,1.52,0,.127],[sign*.58,1.48,0,.103],
      [sign*.72,1.45,0,.082],[sign*.82,1.44,0,.058]
    ], 'x', skin);
    ellipsoid(root, `${side}-shoulder`, [sign*.34,1.56,0], [.135,.14,.14], skin);
    ellipsoid(root, `${side}-palm`, [sign * .88, 1.435, .005], [.093, .044, .067], skin);
    for (let finger = 0; finger < 3; finger++) ellipsoid(root, `${side}-finger-${finger}`, [sign * (.958 + (finger === 1 ? .015 : 0)), 1.424, (finger - 1) * .028], [.043, .019, .018], skin, 16);
    ellipsoid(root, `${side}-thumb`, [sign * .855, 1.401, .095], [.047, .025, .024], skin, 16);
    const hip = sign * .18;
    curvedLimb(root, `${side}-continuous-shorts`, [
      [hip,1.00,0,.163],[hip,.93,0,.165],[hip,.85,0,.162]
    ], 'y', cloth, 1.24);
    const hem=new THREE.Mesh(new THREE.TorusGeometry(.157,.003,8,32),clothTrim);hem.name=`${side}-shorts-hem`;hem.rotation.x=Math.PI/2;hem.position.set(hip,.855,0);hem.scale.y=1.25;root.add(hem);
    curvedLimb(root, `${side}-whole-leg`, [
      [hip,.86,0,.157],[sign*.185,.74,0,.162],[sign*.19,.57,.013,.133],
      [sign*.19,.49,.018,.113],[sign*.195,.34,.026,.12],[sign*.19,.15,.03,.075]
    ], 'y', skin, 1.16);
    ellipsoid(root, `${side}-foot`, [sign * .19, .075, .095], [.108, .066, .17], skin);
    for (let toe = 0; toe < 4; toe++) ellipsoid(root, `${side}-toe-${toe}`, [sign * (.134 + toe * .037), .043, .234], [.021, .018, .03], skin, 12);
  }
  // These landmarks are an inspection guide, not a skinned animation rig.
  const guideJoint = (parent, name, x, y, z = 0) => {
    const joint = new THREE.Bone(); joint.name = `guide.${name}`;
    joint.position.set(x, y, z); parent.add(joint); return joint;
  };
  const hips = guideJoint(root, 'hips', 0, 1.04);
  const spine = guideJoint(hips, 'spine', 0, .31);
  const chest = guideJoint(spine, 'chest', 0, .23);
  const neckGuide = guideJoint(chest, 'neck', 0, .16);
  guideJoint(neckGuide, 'head', 0, .46);
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? 'left' : 'right';
    const shoulder = guideJoint(chest, `${side}Shoulder`, sign * .34, -.02);
    const elbow = guideJoint(shoulder, `${side}Elbow`, sign * .27, -.10);
    guideJoint(elbow, `${side}Wrist`, sign * .24, -.03);
    const thigh = guideJoint(hips, `${side}Hip`, sign * .18, -.17);
    const knee = guideJoint(thigh, `${side}Knee`, sign * .01, -.38);
    const ankle = guideJoint(knee, `${side}Ankle`, 0, -.34, .03);
    guideJoint(ankle, `${side}Toe`, 0, -.08, .18);
  }
  root.userData.boneOverlayKind = 'inferred-guide';
  root.userData.img2threejs = {
    revision: '6e60b5e22419464b4853e01ddb6c0e6f6659a733',
    visibleReference: '1024×1536 single frontal image',
    inferredRegions: ['left profile', 'right profile', 'back', 'head depth', 'body depth'],
    measuredHeadUnits: 2.84,
    fullVolume: true
  };
  return root;
}
