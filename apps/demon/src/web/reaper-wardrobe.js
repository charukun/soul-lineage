import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function transform(g,p=[0,0,0],s=[1,1,1],r=[0,0,0]) {
  return g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(...s)));
}
const oval=(p,s)=>transform(new T.SphereGeometry(1,16,10),p,s);
function merge(parts) {
  const flat=parts.map(p=>{const g=p.index?p.toNonIndexed():p;for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g;});
  const result=mergeGeometries(flat);
  new Set([...parts,...flat]).forEach(p=>p.dispose());
  if(!result)throw new Error('鎌姫の衣装を構成できません。');
  return result;
}
function lock(points,width,depth) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),positions=[],uv=[],indices=[];
  const side=new T.Vector3(),normal=new T.Vector3(),axis=new T.Vector3(0,0,1),steps=16,sides=8;
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=curve.getPoint(t),direction=curve.getTangent(t);
    side.crossVectors(direction,axis).normalize();normal.crossVectors(side,direction).normalize();
    const taper=Math.max(.018,Math.pow(1-t,.4))*(.7+.3*Math.sin(Math.min(1,t*4)*Math.PI/2));
    for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,v=p.clone().addScaledVector(side,Math.cos(a)*width*taper).addScaledVector(normal,Math.sin(a)*depth*taper);positions.push(v.x,v.y,v.z);uv.push(j/sides,t);}
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
  for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const e=steps*sides;indices.push(e,e+j,e+j+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function shell(rows,pleats=0) {
  const positions=[],uv=[],indices=[],segments=64;
  rows.forEach(([y,rx,rz],i)=>{for(let j=0;j<=segments;j++){const a=j/segments*Math.PI*2,k=1+pleats*Math.cos(a*16);positions.push(Math.sin(a)*rx*k,y,Math.cos(a)*rz*k);uv.push(j/segments,i/(rows.length-1));}});
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function rose(p,size) {
  const pieces=[];
  for(let i=0;i<9;i++){const a=i*2.399,r=size*(.18+i*.045);pieces.push(oval([Math.cos(a)*r,Math.sin(a)*r,0],[size*.45,size*.25,size*.14]).rotateZ(a));}
  return transform(merge(pieces),p);
}

/** App-owned wardrobe fitted to the existing Shino raw-bone rig, in metres.
 * Source textures/geometry are never edited; every added resource has one owner.
 */
export function dressReaper(actor) {
  const materials={
    hair:new T.MeshStandardMaterial({color:0xcdd1e2,roughness:.48,metalness:.10}),
    cloth:new T.MeshStandardMaterial({color:0x11101a,roughness:.64,side:T.DoubleSide}),
    satin:new T.MeshStandardMaterial({color:0x29212f,roughness:.35,metalness:.22,side:T.DoubleSide}),
    lace:new T.MeshStandardMaterial({color:0xc1bbcb,roughness:.7,side:T.DoubleSide}),
    metal:new T.MeshStandardMaterial({color:0x443b58,roughness:.3,metalness:.82}),
    edge:new T.MeshStandardMaterial({color:0xa5a0ba,roughness:.25,metalness:.88}),
    violet:new T.MeshStandardMaterial({color:0x8760c8,emissive:0x56308b,emissiveIntensity:.8,roughness:.3}),
  };
  const nodes=[],geometries=new Set();
  const add=(parent,name,geometry,material)=>{geometries.add(geometry);const mesh=new T.Mesh(geometry,materials[material]);mesh.name=name;mesh.frustumCulled=false;parent.add(mesh);nodes.push(mesh);return mesh;};
  actor.visual.traverse(n=>{if(!n.isMesh)return;for(const m of Array.isArray(n.material)?n.material:[n.material]){
    if(/HAIR|Accessory_Tie|Bottoms|Tops/i.test(m.name))m.visible=false;
    if(/Shoes/i.test(m.name)){m.map=null;m.color.set(0x111019);m.roughness=.4;m.needsUpdate=true;}
  }});
  const head=actor.bones.head,spine=actor.bones.spine,hips=actor.bones.hips;
  const crown=transform(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.58),[0,.11,-.015],[.119,.118,.110]);
  const fringe=[crown];
  for(let i=0;i<9;i++){const x=(i-4)*.022;fringe.push(lock([[x*.65,.21,.024],[x,.157,.090],[x*.99,.107,.102],[x+.009,.071+(i%3)*.006,.094]],.023,.011));}
  for(const s of [-1,1])fringe.push(lock([[s*.09,.16,.025],[s*.117,.055,.042],[s*.125,-.12,.052],[s*.17,-.32,.041]],.033,.021));
  add(head,'reaper-silver-fringe',merge(fringe),'hair');
  const hair=new T.Group();hair.name='reaper-long-hair';head.add(hair);nodes.push(hair);
  const locks=[];
  for(let i=0;i<15;i++){const x=(i-7)*.024,z=-.066-.055*Math.cos((i-7)/7*Math.PI/2);locks.push(lock([[x*.54,.15,z],[x*.84,-.06,z-.032],[x*1.04,-.34,z-.10],[x*1.12,-.58+(i%3)*.022,z-.14],[x*.91,-.71+Math.abs(i-7)*.018,z-.115]],.034,.018));}
  add(hair,'reaper-silver-lengths',merge(locks),'hair');
  const flowers=[];
  for(const s of [-1,1]){flowers.push(rose([s*.113,.135,.055],.045));flowers.push(rose([s*.093,.19,.036],.032));}
  add(head,'reaper-ivory-roses',merge(flowers),'lace');
  const ribbons=[];
  for(const s of [-1,1]){ribbons.push(lock([[s*.115,.15,.034],[s*.17,.1,.025],[s*.18,-.05,.008],[s*.15,-.18,.03]],.021,.005));}
  add(head,'reaper-head-ribbons',merge(ribbons),'cloth');
  add(spine,'reaper-bodice',shell([[-.10,.165,.108],[.04,.145,.098],[.17,.162,.124],[.27,.177,.115],[.31,.135,.099]]),'cloth');
  const corset=[];
  for(let i=0;i<5;i++)for(const s of [-1,1])corset.push(transform(new T.CylinderGeometry(.003,.003,.055,5),[s*.012,.045+i*.028,.104],[1,1,1],[0,0,s*.8]));
  corset.push(rose([0,.29,.106],.036));
  add(spine,'reaper-silver-lacing',merge(corset),'lace');
  const skirt=new T.Group();skirt.name='reaper-skirt';hips.add(skirt);nodes.push(skirt);
  add(skirt,'reaper-pleated-dress',shell([[.02,.147,.098],[-.08,.195,.141],[-.22,.277,.196],[-.34,.316,.235]],.046),'cloth');
  add(skirt,'reaper-lace-hem',shell([[-.328,.318,.237],[-.345,.320,.239],[-.358,.312,.232]],.05),'lace');
  add(skirt,'reaper-overskirt',shell([[-.005,.153,.104],[-.08,.218,.159],[-.22,.289,.215]],.07),'satin');
  for(const side of ['left','right']){
    const s=side==='left'?1:-1;
    add(actor.bones[side+'UpperArm'],`reaper-${side}-puff`,oval([s*.062,-.016,0],[.12,.098,.104]),'cloth');
    add(actor.bones[side+'LowerArm'],`reaper-${side}-sleeve`,transform(new T.CylinderGeometry(.063,.043,.15,16),[s*.145,0,0],[1,1,1],[0,0,Math.PI/2]),'cloth');
    add(actor.bones[side+'Hand'],`reaper-${side}-cuff`,transform(new T.TorusGeometry(.047,.008,6,18),[-s*.005,0,0],[1,1,1],[0,Math.PI/2,0]),'lace');
    add(actor.bones[side+'UpperLeg'],`reaper-${side}-stocking-upper`,transform(new T.CylinderGeometry(.069,.062,.24,14),[0,-.26,0]),'cloth');
    add(actor.bones[side+'LowerLeg'],`reaper-${side}-stocking-lower`,shell([[.012,.069,.076],[-.10,.078,.088],[-.24,.065,.069],[-.42,.049,.052]]),'cloth');
  }
  const scythe=new T.Group();scythe.name='reaper-scythe';
  add(scythe,'reaper-scythe-shaft',transform(new T.CylinderGeometry(.026,.021,2.0,12),[0,.45,0]),'cloth');
  const ferrules=[];
  for(const y of [-.53,-.18,.35,1.22,1.40])ferrules.push(transform(new T.CylinderGeometry(.036,.036,.055,12),[0,y,0]));
  add(scythe,'reaper-scythe-ferrules',merge(ferrules),'metal');
  const blade=new T.Shape();blade.moveTo(.075,1.34);blade.bezierCurveTo(-.28,1.65,-1.10,1.65,-1.54,.65);blade.bezierCurveTo(-1.0,1.20,-.38,1.27,-.015,1.16);blade.lineTo(.075,1.34);
  add(scythe,'reaper-crescent-blade',transform(new T.ExtrudeGeometry(blade,{depth:.026,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.012,bevelThickness:.008,curveSegments:24}),[0,0,-.013]),'metal');
  const edge=new T.CubicBezierCurve3(new T.Vector3(-1.54,.65,0),new T.Vector3(-1,1.20,0),new T.Vector3(-.38,1.27,0),new T.Vector3(-.015,1.16,0));
  add(scythe,'reaper-scythe-cutting-edge',new T.TubeGeometry(edge,30,.013,5,false),'edge');
  add(scythe,'reaper-scythe-seal',transform(new T.OctahedronGeometry(.085),[0,1.32,.046],[.8,1.25,.55]),'violet');
  return {hair,skirt,scythe,dispose(){nodes.forEach(n=>n.removeFromParent());geometries.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());}};
}
