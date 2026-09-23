// img2threejs character route: measured front silhouette -> component hierarchy -> procedural surfaces.
// Coordinates are in metres, +Y up and +Z towards the observed front. Depth and rear surfaces are inferred.
export function createReferenceChibi(THREE) {
  const root = new THREE.Group();
  root.name = 'ReferenceChibi_20260923';
  const skin = new THREE.MeshStandardMaterial({ color: '#ffdfdc', roughness: .73 });
  const earSkin = new THREE.MeshStandardMaterial({ color: '#f4c5c4', roughness: .8 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#b7b7bc', roughness: .94, side: THREE.DoubleSide });
  const seam = new THREE.MeshStandardMaterial({ color: '#a2a2a8', roughness: .9 });
  const white = new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: .35 });
  const iris = new THREE.MeshPhysicalMaterial({ color: '#63d9be', roughness: .22, clearcoat: .7 });
  const irisDark = new THREE.MeshStandardMaterial({ color: '#398b80', roughness: .35 });
  const pupil = new THREE.MeshStandardMaterial({ color: '#182d30', roughness: .22 });
  const ink = new THREE.MeshStandardMaterial({ color: '#35292b', roughness: .65 });
  const blush = new THREE.MeshStandardMaterial({ color: '#deaaaa', roughness: .9 });
  const glow = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const sphere = new THREE.SphereGeometry(1, 32, 20);
  const add = (parent, name, material, position, scale, geometry = sphere) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const line = (parent, name, points, radius, material) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6, false), material);
    mesh.name = name; parent.add(mesh); return mesh;
  };
  const segment = (parent, name, from, to, r0, r1, material) => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, start.distanceTo(end), 16, 1), material);
    mesh.name = name; mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  // Lofted leotard: its waist, belly and shorts share one continuous silhouette.
  const rings = [
    [ .91, .22, .16 ], [ 1.00, .32, .22 ], [ 1.15, .32, .22 ],
    [ 1.34, .25, .20 ], [ 1.52, .26, .22 ], [ 1.68, .33, .23 ], [ 1.73, .18, .13 ],
  ];
  const verts = [], indices = [], sides = 36;
  rings.forEach(([y, rx, rz]) => {
    for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides;
      verts.push(Math.sin(a) * rx, y, Math.cos(a) * rz);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
    const a = j * sides + i, b = j * sides + (i + 1) % sides;
    indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  bodyGeometry.setIndex(indices); bodyGeometry.computeVertexNormals();
  add(root, 'Continuous grey sleeveless suit', cloth, [0, 0, 0], [1, 1, 1], bodyGeometry);
  add(root, 'Collar', seam, [0, 1.745, 0], [.18, .045, .125]);
  for (const side of [-1, 1]) {
    const s = side;
    add(root, `Shorts ${s}`, cloth, [s * .171, .99, 0], [.16, .105, .185]);
    line(root, `Shorts hem ${s}`, [[s*.06,.937,.166],[s*.17,.927,.184],[s*.31,.95,.1]], .005, seam);
    const hip = [s*.18, .98, 0], knee = [s*.20, .57, .025], ankle = [s*.20, .115, .035];
    segment(root, `Upper leg ${s}`, hip, knee, .155, .113, skin);
    add(root, `Knee ${s}`, skin, knee, [.115, .125, .11]);
    segment(root, `Lower leg ${s}`, knee, ankle, .113, .084, skin);
    add(root, `Foot ${s}`, skin, [s*.2,.072,.115], [.09,.065,.19]);
    for (let i=0;i<5;i++) add(root, `Toe ${s}/${i}`, skin,
      [s*(.145+i*.028),.049,.262-(i*.009)], [.019,.022,.032]);
    // Neutral reference arms descend slightly from the shoulders.
    const shoulder=[s*.325,1.67,0], elbow=[s*.615,1.525,.015], wrist=[s*.85,1.435,.05];
    add(root, `Shoulder ${s}`, skin, shoulder, [.155,.14,.15]);
    segment(root, `Upper arm ${s}`, shoulder, elbow, .115,.084,skin);
    add(root, `Elbow ${s}`,skin,elbow,[.083,.078,.08]);
    segment(root, `Forearm ${s}`, elbow,wrist,.082,.054,skin);
    add(root, `Palm ${s}`,skin,[s*.898,1.42,.055],[.075,.042,.062]);
    for(let i=0;i<4;i++) add(root,`Finger ${s}/${i}`,skin,
      [s*(.955+i*.008),1.405+i*.011,.075-i*.028],[.043-i*.003,.018,.018]);
    add(root, `Thumb ${s}`,skin,[s*.862,1.389,.126],[.048,.023,.025]);
  }
  add(root, 'Neck', skin, [0,1.78,0], [.14,.13,.14]);
  const head = new THREE.Group(); head.name='HeadPivot'; head.position.y=2.25; root.add(head);
  add(head,'Cranium',skin,[0,.03,0],[.51,.52,.385]);
  add(head,'Cheek and jaw',skin,[0,-.245,.075],[.414,.275,.34]);
  add(head,'Chin',skin,[0,-.424,.088],[.225,.076,.22]);
  for (const s of [-1,1]) {
    add(head,`Outer ear ${s}`,skin,[s*.506,-.205,.005],[.086,.126,.076]);
    add(head,`Inner ear ${s}`,earSkin,[s*.551,-.203,.055],[.039,.073,.014]);
    add(head,`Eye white ${s}`,white,[s*.238,-.095,.366],[.144,.142,.037]);
    add(head,`Iris border ${s}`,irisDark,[s*.238,-.104,.403],[.088,.115,.014]);
    add(head,`Mint iris ${s}`,iris,[s*.238,-.108,.416],[.075,.101,.014]);
    add(head,`Pupil ${s}`,pupil,[s*.238,-.092,.433],[.021,.047,.008]);
    add(head,`Catchlight upper ${s}`,glow,[s*.205,-.046,.444],[.026,.023,.006]);
    add(head,`Catchlight lower ${s}`,glow,[s*.281,-.154,.434],[.014,.014,.005]);
    line(head,`Upper eyelid ${s}`,[[s*.095,-.08,.399],[s*.16,.025,.409],[s*.29,.036,.405],[s*.386,-.053,.35]],.012,ink);
    line(head,`Winged eyeliner ${s}`,[[s*.325,-.017,.4],[s*.398,-.043,.36],[s*.445,-.02,.32]],.012,ink);
    line(head,`Eyebrow ${s}`,[[s*.125,.155,.39],[s*.22,.196,.39],[s*.36,.165,.35]],.004,ink);
    add(head,`Outer beauty mark ${s}`,ink,[s*.392,-.185,.309],[.006,.008,.004]);
    add(head,`Inner beauty mark ${s}`,ink,[s*.37,-.174,.325],[.004,.005,.004]);
    add(head,`Cheek warmth ${s}`,blush,[s*.29,-.25,.34],[.08,.022,.004]);
  }
  add(head,'Nose',skin,[0,-.254,.408],[.037,.024,.035]);
  line(head,'Small smile',[[-.046,-.349,.389],[0,-.362,.402],[.047,-.345,.389]],.003,blush);
  root.userData.inferred=['back of head','rear garment','body depth','unseen ear surfaces'];
  root.userData.headPivot=head;
  return root;
}
