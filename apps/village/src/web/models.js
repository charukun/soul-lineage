import { THREE as T } from '@soul/rendering';
import {ASSETS} from './asset-data.js';
import {NATURE} from './nature-data.js';
import {defs} from '../game/core.js';
const mats=new Map(),templates=new Map();
const unitBox=new T.BoxGeometry(1,1,1),sphereGeo=new T.SphereGeometry(1,10,8),cylGeo=new T.CylinderGeometry(1,1,1,10),coneGeo=new T.ConeGeometry(1,1,10);
const rnd=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
let textile;
function cloth(){if(textile)return textile;const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#f1eee8';x.fillRect(0,0,256,256);for(let j=0;j<160;j++){const v=Math.floor(204+rnd(j+13)*48);x.fillStyle=`rgba(${v},${v},${v},.14)`;x.beginPath();x.ellipse(rnd(j+2)*256,rnd(j+33)*256,8+rnd(j)*20,7+rnd(j+5)*20,0,0,6.283);x.fill();}for(let i=0;i<14000;i++){let px=rnd(i)*256,py=rnd(i+41)*256,v=Math.floor(160+rnd(i+78)*94);x.strokeStyle=`rgba(${v},${v},${v},.32)`;x.lineWidth=.3+rnd(i+95);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(i)*3,py+2+rnd(i+52)*6);x.stroke();}textile=new T.CanvasTexture(c);textile.wrapS=textile.wrapT=T.RepeatWrapping;textile.anisotropy=4;return textile;}
export function mat(c,textured=true,extra={}){const k=c+'|'+textured+'|'+JSON.stringify(extra);if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color:c,roughness:.94,metalness:0,...(textured?{map:cloth(),bumpMap:cloth(),bumpScale:.10}:{}),...extra}));return mats.get(k);}
function mesh(g,geo,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
const box=(g,x,y,z,w,h,d,c)=>mesh(g,unitBox,mat(c),x,y,z,w,h,d);
const ball=(g,x,y,z,r,c,sy=1)=>mesh(g,sphereGeo,mat(c),x,y,z,r,r*sy,r);
const cyl=(g,x,y,z,r,h,c)=>mesh(g,cylGeo,mat(c),x,y,z,r,h,r);
function limb(g,a,b,r,c){const p=new T.Vector3(...a),q=new T.Vector3(...b),o=cyl(g,0,0,0,r,p.distanceTo(q),c);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return o;}
const palette={wood:0x81624c,stone:0xead8b1,stoneDark:0xa48c74,roof:0xbb6a50,roofLight:0xd48461};
function sourceGeometry(name,matrix,output){const a=ASSETS[name]||NATURE[name];if(!a)throw Error('Required external asset missing: '+name);for(const [group,faces]of Object.entries(a.groups)){output[group]??=[];for(const face of faces)for(let i=1;i<face.length-1;i++)for(const n of [face[0],face[i],face[i+1]]){const p=new T.Vector3(...a.vertices[n]).applyMatrix4(matrix);output[group].push(p.x,p.y,p.z);}}}
function assemble(kind,level=1){
 const d=defs[kind],out={},M=new T.Matrix4(),Q=new T.Quaternion();
 const part=(name,x,y,z,sx,sy,sz,rot=0)=>{Q.setFromAxisAngle(new T.Vector3(0,1,0),rot);M.compose(new T.Vector3(x,y,z),Q,new T.Vector3(sx,sy,sz));sourceGeometry(name,M,out);};
 // Every exterior triangle comes from the six cited Kenney mesh files.
 const wallH=3.3,floors=d.floors+Math.max(0,level-1);
 for(let floor=0;floor<floors;floor++)for(let side=0;side<4;side++){
 const angle=side*Math.PI/2,along=side%2?d.w:d.d,across=side%2?d.d:d.w,n=Math.max(2,Math.round(along/4)),seg=along/n;
 for(let j=0;j<n;j++){const door=side===3&&floor===0&&j===Math.floor(n/2);const name=door?'wallDoorwaySquareWide':(j+floor)%2===0?'wallWindowSmall':'wall';
 const v=new T.Vector3(across/2-.45,0,-along/2+seg*(j+.5)).applyAxisAngle(new T.Vector3(0,1,0),angle);
 part(name,v.x,floor*wallH,v.z,.9,wallH,seg,angle);}
 }
 const top=floors*wallH;
 part(kind==='tower'?'roofPoint':'roofGable',0,top,0,d.w+.4,kind==='tower'?11:d.d*.63,d.d+.4);
 if(kind!=='tower'){part('chimney',-d.w*.24,top+1.6,-d.d*.18,3.4,4,3.4);}
 const geometries={};for(const [group,positions] of Object.entries(out)){
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();const n=geo.attributes.normal.array,uv=[];
 for(let i=0;i<positions.length;i+=3){const ax=Math.abs(n[i]),ay=Math.abs(n[i+1]),az=Math.abs(n[i+2]);uv.push((ax>ay&&ax>az?positions[i+2]:positions[i])*.18,(ay>ax&&ay>az?positions[i+2]:positions[i+1])*.18);}
 geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeBoundingBox();geo.computeBoundingSphere();geometries[group]=geo;
 }
 return geometries;
}
function masonryBuilding(kind,material="base",level=1){const key=kind+":"+level;if(!templates.has(key))templates.set(key,assemble(kind,level));const g=new T.Group(),d=defs[kind];for(const [group,geo]of Object.entries(templates.get(key))){let c=palette[group]||palette.stone;if(group==='stone')c=material==='timber'?0xbb9976:material==='stone'?0xb5beb8:material==='earth'?0xd2b084:c;if(group==='stoneDark'&&material==='stone')c=0x8e9d99;if(group==='roof')c=d.roof;if(group==='roofLight')c=new T.Color(d.roof).lerp(new T.Color(0xffe6ad),.25).getHex();const m=mesh(g,geo,mat(c));m.userData.source='Kenney Fantasy Town Kit';}g.userData.assetBacked=true;return g;}
export function prop(kind,seed=1){const g=new T.Group(),wood=0x8a6345,dark=0x614d3b;
 if(kind==='terrainRock'){g.add(rawAsset('stone',{stone:0x9aa393},[13,14,13]));}
 else if(kind==='fence'){
 for(const x of[-1.8,1.8])box(g,x,.8,0,.18,1.6,.18,wood);
 for(const y of[.55,1.15])box(g,0,y,0,4,.16,.14,wood);
 }else if(kind==='wall'){
 for(let row=0;row<3;row++)for(let j=0;j<4;j++)box(g,-1.5+j+((row%2)*.1),.25+row*.48,0,.94,.44,.72,[0xbab29a,0xaaa88e][(row+j)%2]);
 }else if(kind==='tree'||kind==='pine'){
 cyl(g,0,2,0,.22,4,wood);for(let i=0;i<3;i++){const a=i*2.3;limb(g,[0,2+i*.5,0],[Math.cos(a)*1.2,4+i*.3,Math.sin(a)*1.2],.1,wood);}
 if(kind==='pine'){for(let i=0;i<4;i++)mesh(g,coneGeo,mat([0x477561,0x588674,0x759e7d,0x8fb18b][i]),0,3+i*.9,0,2-i*.36,3.4,2-i*.36);}
 else for(let i=0;i<9;i++){const a=i*2.4,r=i?1.5:0;ball(g,Math.cos(a)*r,4.6+rnd(seed+i)*1.3,Math.sin(a)*r,1.45+rnd(i+seed)*.45,[0x709c65,0x86ae6b,0xacc779,0x8bb384][i%4],1.06);}
 }else if(kind==='flowers'||kind==='plant'){
 if(kind==='plant')cyl(g,0,.4,0,.4,.8,0xc58262);
 const n=kind==='flowers'?22:8;for(let i=0;i<n;i++){let x=(rnd(seed+i)-.5)*(kind==='flowers'?2.3:.7),z=(rnd(seed+i+52)-.5)*(kind==='flowers'?2.3:.7),y=(kind==='plant'?.8:0)+.35+rnd(seed+i+37)*.4;
 cyl(g,x,y/2,z,.025,y,0x78945a);ball(g,x+.1,y*.65,z,.18,0x68956b,.35);ball(g,x,y,z,.14,[0xe8b3bd,0xffecb4,0xdfa073,0xa1aad6,0xf5ede0][i%5],.7);ball(g,x,y+.04,z,.055,0xd9a14b);}
 }else if(kind==='hedge'){for(let i=0;i<5;i++)ball(g,-1.6+i*.8,.9,0,.76,i%2?0x668b60:0x789d66,1.2);}
 else if(kind==='lamp'){
 cyl(g,0,1.1,0,.055,2.2,dark);limb(g,[0,2.18,0],[.4,2.18,0],.06,dark);
 box(g,.35,1.91,0,.34,.47,.34,0x694c34);mesh(g,unitBox,mat(0xffdf96,false,{emissive:0xffc269,emissiveIntensity:.55}),.35,1.94,0,.26,.33,.37);
 mesh(g,coneGeo,mat(0x685745),.35,2.25,0,.34,.25,.34);
 }else if(kind==='bench'){
 for(const x of[-1.05,1.05]){box(g,x,.38,0,.18,.75,.9,dark);box(g,x,1.12,-.45,.12,1.1,.15,dark);}for(let i=0;i<3;i++){box(g,0,.78,-.32+i*.32,2.7,.12,.26,wood);box(g,0,1.1+i*.18,-.47,2.7,.13,.09,wood);}
 }else if(kind==='path'){
 const geo=new T.CylinderGeometry(1.7,1.7,.035,8);mesh(g,geo,mat(0xd5c5a6),0,.018,0,1,1,1);
 }else if(kind==='bed'){
 box(g,0,.35,0,2.05,.5,3.3,wood);box(g,0,1.05,-1.56,2.15,1.45,.18,wood);
 box(g,0,.7,0,1.95,.25,3.1,0xf0e2c8);box(g,0,.91,.45,1.96,.17,2,0x80a99d);box(g,0,.98,-1.03,1.55,.25,.65,0xffefda);
 }else if(kind==='sofa'){
 box(g,0,.4,0,3.3,.6,1.6,wood);box(g,0,.94,0,3,.65,1.48,0xc69092);box(g,0,1.24,-.62,3.15,1.2,.4,0xb98788);for(const x of[-1.45,1.45])box(g,x,1,0,.3,.9,1.7,0xc99b9b);
 }else if(['table','counter','workbench'].includes(kind)){
 const d=defs[kind];box(g,0,1.15,0,d.w,.18,d.d,wood);for(const x of[-d.w*.4,d.w*.4])for(const z of[-d.d*.38,d.d*.38])box(g,x,.56,z,.18,1.1,.18,dark);
 if(kind==='counter')box(g,0,.65,0,d.w,.9,d.d*.8,0xad8b61);if(kind==='workbench'){for(let i=0;i<4;i++)box(g,-.9+i*.5,1.36,0,.32,.15,.4,[0xb18c64,0x738e9b][i%2]);}
 }else if(kind==='chair'){
 box(g,0,.7,0,.95,.16,.92,wood);for(const x of[-.34,.34])for(const z of[-.33,.33])box(g,x,.35,z,.12,.7,.12,dark);box(g,0,1.16,-.4,.92,.87,.13,wood);
 }else if(kind==='shelf'){
 box(g,0,1.15,-.39,2.6,2.3,.13,wood);for(const x of[-1.24,1.24])box(g,x,1.15,0,.12,2.3,.9,wood);
 for(let j=0;j<4;j++){box(g,0,.13+j*.69,0,2.6,.12,.9,wood);if(j<3)for(let i=0;i<9;i++)box(g,-1.06+i*.26,.42+j*.69,.02,.17,.42+rnd(i)*.12,.45,[0x9f747a,0x789b90,0xb39a61,0x6a8293][i%4]);}
 }else if(kind==='hearth'){
 box(g,0,.13,0,2.5,.26,1.2,0xa99a80);for(const x of[-.92,.92])box(g,x,1,0,.45,1.9,1.1,0xccbca0);box(g,0,1.89,0,2.45,.3,1.15,0xb4a489);box(g,0,2.36,-.2,1.4,.65,.73,0xdccdaf);mesh(g,coneGeo,mat(0xe99a4e,false,{emissive:0xff7030,emissiveIntensity:.65}),0,.6,.04,.4,.85,.4);
 }else if(kind==='rug'){const m=box(g,0,.025,0,4.4,.04,3.2,0xb27982);for(const x of[-2.05,2.05])box(g,x,.05,0,.12,.01,3.15,0xe8ce9f);for(const z of[-1.45,1.45])box(g,0,.05,z,4.3,.01,.1,0xe8ce9f);}
 return g;
}
export function person(seed=0,monster=false,role='resident'){
 const g=new T.Group(),body=new T.Group();g.add(body);const colors=[0x789c8a,0xc18d76,0x788eab,0xc7b17f,0x9c809d],c=monster?0x666074:role==='guard'?0x678ca5:role==='mayor'?0xb2955f:role==='player'?0x9b87b0:colors[Math.floor(seed)%5],skin=monster?0x96a57e:0xdac09b;
 const legs=[];for(const x of[-.17,.17]){const joint=new T.Group();joint.position.set(x,.73,0);body.add(joint);cyl(joint,0,-.24,0,.105,.48,0x796c54);ball(joint,0,-.53,.05,.15,0x705847,.7);legs.push(joint);}
 ball(body,0,1.03,0,.39,c,1.25);cyl(body,0,.8,0,.34,.23,0x78604c);ball(body,0,1.6,0,.34,skin,1.08);ball(body,0,1.79,-.07,.34,monster?0x4e495b:0x77614d,.65);
 for(const x of[-.34,.34])limb(body,[x,1.17,0],[x*1.35,.77,.1],.1,c);
 for(const x of[-.13,.13])ball(body,x,1.62,.304,.027,0x3b3935);
 if(monster)for(const x of[-.25,.25])mesh(body,coneGeo,mat(0xc5b594),x,1.99,0,.08,.32,.08);
 if(role==='guard'){const shield=mesh(body,new T.CylinderGeometry(.35,.35,.10,8),mat(0x809ca8),-.53,1.05,.13);shield.rotation.x=Math.PI/2;box(body,-.53,1.05,.20,.10,.5,.04,0xddcea4);limb(body,[.42,.8,.13],[.46,1.7,.2],.035,0xd6d3c0);}
 if(role==='mayor'){mesh(body,coneGeo,mat(0xc3a567),0,1.93,-.02,.37,.33,.37);box(body,0,1.06,-.3,.50,.66,.10,0xb19a6f);}
 if(role==='player'){box(body,0,1.12,-.30,.55,.8,.12,0x8e7ca9);ball(body,0,1.25,.37,.085,0xe5c788);}
 g.userData.legs=legs;g.userData.body=body;return g;
}
export function interiorShell(host){const d=defs[host.kind],g=new T.Group();
 box(g,0,-.18,0,d.w,.35,d.d,0xbb9367);
 // Interior room is an editor cutaway, not a replacement exterior model.
 for(let i=0;i<Math.ceil(d.w/.7);i++)box(g,-d.w/2+i*.7,.012,0,.035,.014,d.d,0xab825a);
 const out={},M=new T.Matrix4(),Q=new T.Quaternion();
 for(const side of[0,1]){const along=side===0?d.d:d.w,across=side===0?d.w:d.d,n=Math.round(along/4),seg=along/n,angle=side===0?Math.PI:Math.PI/2;for(let j=0;j<n;j++){const pos=new T.Vector3(across/2-.45,0,-along/2+(j+.5)*seg).applyAxisAngle(new T.Vector3(0,1,0),angle);Q.setFromAxisAngle(new T.Vector3(0,1,0),angle);M.compose(pos,Q,new T.Vector3(.9,3.3,seg));sourceGeometry(j%2?'wall':'wallWindowSmall',M,out);}}
 for(const [type,positions]of Object.entries(out)){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();mesh(g,geo,mat(palette[type],false));}
 return g;
}

const rawCache=new Map();
/** Convert acquired mesh topology, not a procedural substitute for its silhouette. */
function rawAsset(name,colors,scale=[1,1,1]){
 const group=new T.Group();let geos=rawCache.get(name);
 if(!geos){const data={},M=new T.Matrix4();sourceGeometry(name,M,data);geos={};for(const[k,pos]of Object.entries(data)){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.computeVertexNormals();const uv=[];for(let i=0;i<pos.length;i+=3)uv.push((pos[i]+pos[i+2])*.45,pos[i+1]*.45);geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geos[k]=geo;}rawCache.set(name,geos);}
 for(const[k,geo]of Object.entries(geos)){const n=mesh(group,geo,mat(colors[k]||colors.default||0xb69e7d,true,{side:T.DoubleSide}));n.userData.source='Kenney CC0 acquired topology';}
 group.scale.set(...scale);group.userData.assetBacked=true;return group;
}
function tentModel(w,d,color){return rawAsset('tent',{cloth:color,patch:new T.Color(color).multiplyScalar(.77).getHex(),wood:0x78624d},[w/.5476,6/.56113,d/.6664]);}
/** Distinct work-site silhouettes assembled from the existing timber/stone vocabulary. */
function workSite(kind,d){
 const g=new T.Group(),wood=0x927151,trim=0x69563e,roof=0x9c9f79;
 const timber=(x,y,z,w,h,depth)=>box(g,x,y,z,w,h,depth,wood);
 const log=(x,y,z,len=3)=>{const n=cyl(g,x,y,z,.29,len,wood);n.rotation.z=Math.PI/2;const cap=cyl(g,x+len/2+.01,y,z,.25,.03,0xd0b782);cap.rotation.z=Math.PI/2;};
 const shed=(x,z,w,depth)=>{
  for(const dx of[-w/2+.2,w/2-.2])for(const dz of[-depth/2+.2,depth/2-.2])timber(x+dx,1.55,z+dz,.28,3.1,.28);
  for(let i=0;i<6;i++){const n=box(g,x,3.15+(i/5)*.5,z-depth/2+i*depth/5,w+.45,.16,depth/5+.06,roof);n.rotation.x=-.09;}
  timber(x,2.7,z-depth/2,w,.2,.22);
 };
 const sign=(x,z)=>{timber(x,.85,z,.14,1.7,.14);box(g,x,1.5,z,1.2,.65,.12,trim);};
 if(kind==='logging'){
  shed(-1.9,-2.6,5.6,4);for(let row=0;row<3;row++)for(let col=0;col<3-row;col++)log(-2+col*.12,.35+row*.51,-2.7+col*.68,4.4);
  timber(2.7,.95,1.5,3.7,.22,1.1);for(const x of[1.25,4.15])for(const z of[1.1,1.9])timber(x,.45,z,.2,.9,.2);
  log(2.6,1.2,1.5,3.9);const stump=cyl(g,-2.5,.45,2.6,.75,.9,trim);cyl(g,-2.5,.92,2.6,.65,.04,0xd1b986);sign(4.5,3.8);
 }else if(kind==='storage'){
  for(const x of[-3.8,3.8]){shed(x,-1.2,2.7,6.5);for(const y of[.55,1.7]){timber(x,y,-1.2,2.5,.15,6.2);for(let i=0;i<3;i++)box(g,x,y+.45,-3.4+i*2,1.8,.85,1.5,0xa7895f);}}
  for(let i=0;i<3;i++)box(g,-1.5+i*1.5,.5,-4.5,1.2,1,1.3,0xb6a079);sign(3.8,4.4);
 }else if(kind==='quarry'){
  for(let i=0;i<5;i++){const rock=rawAsset('stone',{stone:0x949c8c},[16+i%2*5,18+i%3*6,14]);rock.position.set(-5+i*2.5,0,-3.3);g.add(rock);}
  for(let i=0;i<6;i++)box(g,-3+(i%3)*1.2,.3+Math.floor(i/3)*.6,.3+(i%2)*.5,1.05,.58,.85,0xb1b3a0);
  timber(3.6,2.3,1.1,.36,4.6,.36);timber(2.5,4.5,1.1,3.4,.3,.3);limb(g,[3.6,3.1,1.1],[1.8,4.5,1.1],.12,trim);limb(g,[1.4,4.5,1.1],[1.4,1,1.1],.025,trim);sign(-4.8,4);
 }else if(kind==='clay'){
  box(g,-1,.09,-1.4,7.5,.16,6,0x99836c);for(let i=0;i<3;i++){const basket=rawAsset('stone',{stone:0xb79370},[5,5,5]);basket.position.set(3.6,0,-2+i*2);g.add(basket);}timber(-1,1.1,3,5,.16,1.6);for(const x of[-3,1])timber(x,.55,3,.25,1.1,.25);sign(4,3.9);
 }else if(kind==='carpenter'){
  shed(0,-1,9,6.8);timber(0,1.1,-.8,6,.25,1.7);for(const x of[-2.6,2.6])for(const z of[-1.4,-.2])timber(x,.55,z,.27,1.1,.27);
  for(let i=0;i<7;i++){const plank=timber(-3.7+i*.35,1.35,-3.5,.25,2.7,.12);plank.rotation.z=-.12;}
  for(let i=0;i<3;i++)timber(2.9,.2+i*.25,2.9,3.5,.22,.8);sign(4.5,3.7);
 }else if(kind==='guardpost'){
  // An open watch platform reads differently from housing tents.
  for(const x of[-2,2])for(const z of[-2,2])timber(x,1.3,z,.38,2.6,.38);
  timber(0,2.65,0,5,.25,5);for(const x of[-2.2,2.2]){timber(x,3.25,0,.17,1.1,.17);timber(x,3.6,0,.15,.15,4.5);}
  timber(0,3.6,-2.2,4.5,.15,.15);for(let i=0;i<6;i++)timber(0,.2+i*.4,2.7-i*.23,1.4,.16,.4);
  timber(-2,4.5,-2,.16,3.7,.16);box(g,-1.3,5.7,-2,1.4,.8,.07,0x9e6e5b);sign(3.5,3.7);
 }
 g.name='work-site-'+kind;return g;
}
export function building(kind,material='base',level=1){const d=defs[kind];if(!d)return new T.Group();
 let g;
 if(['logging','storage','quarry','clay','carpenter','guardpost'].includes(kind)){g=workSite(kind,d);}
 else if(d.shape==='tent'){g=tentModel(d.w,d.d,d.roof);}
 else if(d.shape==='fire'){g=rawAsset('campfire',{wood:0x775b44},[9,9,9]);}
 else if(['yard','field','market','pond','orchard'].includes(d.shape)){
  g=new T.Group();
  // Open production lots reuse acquired tents/campfire timber. Soil, crops and trees are landscaping.
  if(!['field','orchard','pond'].includes(d.shape)){const t=tentModel(d.w*.50,d.d*.48,d.roof);t.position.set(-d.w*.13,0,-d.d*.18);g.add(t);}
  if(d.shape==='market'){const t=tentModel(d.w*.30,d.d*.40,0xc6b696);t.position.set(d.w*.31,0,-d.d*.20);g.add(t);for(let i=0;i<3;i++){const p=prop('table');p.position.set(-5+i*4,0,d.d*.24);g.add(p);}}
  if(d.shape==='yard'){for(let i=0;i<3;i++){const logs=rawAsset(kind==='quarry'||kind==='clay'?'stone':'campfire',{default:kind==='quarry'?0x9a9e97:kind==='clay'?0x9f8272:0x96734f},[8,9,8]);logs.position.set(-3+i*3,0,d.d*.29);g.add(logs);}}
  if(d.shape==='field'){for(let rr=0;rr<4;rr++){const soil=rawAsset('soil',{dirt:0xa09470},[d.w/1.6,1,d.d*2]);soil.position.x=-d.w*.36+rr*d.w*.24;g.add(soil);}for(let r=0;r<8;r++)for(let c=0;c<12;c++){const x=-d.w*.43+c*d.w*.077,z=-d.d*.40+r*d.d*.113;const stem=cyl(g,x,.4,z,.045,.8,0xbaa45b);ball(g,x,.87,z,.16,0xdbbd6d,1.6);}}
  if(d.shape==='orchard'){for(let r=0;r<2;r++)for(let c=0;c<3;c++){const t=prop('tree',c+r*3);t.position.set(-5+c*5,0,-5+r*9);t.scale.setScalar(.82);g.add(t);}}
  if(d.shape==='pond'){const water=new T.Mesh(new T.CircleGeometry(d.w*.40,40),mat(0x72a7a5,false,{roughness:.24,metalness:.12}));water.rotation.x=-Math.PI/2;water.position.y=.08;water.scale.y=1.07;g.add(water);for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const rock=rawAsset('stone',{stone:0xc3b99c},[4,2,4]);rock.position.set(Math.cos(a)*d.w*.43,.06,Math.sin(a)*d.d*.44);g.add(rock);}}
 }else{g=masonryBuilding(kind,material,level);if(d.shape==='estate'){for(let i=0;i<4;i++){const p=prop('flowers',i);p.position.set(-5+i*3,0,d.d*.3);g.add(p);}}}
 if(kind==='harbor'){
  // A timber pier assembled from the already acquired wall module, laid flat and recolored.
  for(let i=0;i<14;i++){const p=rawAsset('pier',{default:0xaa8a61},[2,2,5]);p.position.set(9+i*2,.12,0);g.add(p);}
 }
 // Visual growth uses already-acquired mesh accessories, not a new bespoke facility.
 if(level>1&&kind!=='campfire'){const accent=rawAsset('stone',{stone:material==='earth'?0xb0987e:0xb5b9a5},[4+level,3,4+level]);accent.position.set(d.w*.38,0,-d.d*.32);g.add(accent);if(level===3){const other=accent.clone();other.position.x=-d.w*.38;g.add(other);}}
 g.userData.assetBacked=true;return g;
}
export function floorFor(host){const d=defs[host.kind],g=new T.Group();if(d.open||d.shape==='yard'||d.shape==='market')return g;
 box(g,0,.035,0,d.w-.7,.07,d.d-.7,0xbba07a);
 for(let x=-d.w/2+.6;x<d.w/2-.3;x+=.65)box(g,x,.079,0,.025,.006,d.d-.7,0xa78e6c);return g;
}
export function sailingShip(){const g=new T.Group(),hull=rawAsset('boat',{wood:0x957957},[2.5,1.7,2.5]);hull.position.z=-3;g.add(hull);
 // Acquired hull adapted as a fantasy transport: rigging/sails are generated accessories.
 for(const[z,height]of[[-11,26],[2,32],[14,23]]){
  cyl(g,0,6+height/2,z,.22,height,0x7e654c);
  for(const[y,w,h]of[[height,15,8],[height-9,18,8]]){
   limb(g,[-w/2,y,z],[w/2,y,z],.15,0x947655);
   const geo=new T.PlaneGeometry(w,h,8,6),p=geo.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),yy=p.getY(i);p.setZ(i,Math.sin((x/w+.5)*Math.PI)*1.8*Math.sin((yy/h+.5)*Math.PI));}
   geo.computeVertexNormals();const sail=new T.Mesh(geo,mat(z===2?0xe6dcc0:0xd1c6a4,true,{side:T.DoubleSide}));sail.position.set(0,y-h/2,z);sail.castShadow=true;g.add(sail);
  }
  for(const x of[-8,8])limb(g,[x,5,z+7],[0,height+4,z],.045,0x7c735c);
 }
 g.userData.assetBackedHull=true;return g;
}

/** Local, low-poly wildlife. Buildings continue to use the bundled acquired assets. */
export function animal(species='deer'){
 const g=new T.Group(),body=new T.Group();g.add(body);const rabbit=species==='rabbit',wolf=species==='wolf',boar=species==='boar';
 const c=rabbit?0xd7cbb3:wolf?0x89958b:boar?0x867667:0xbc9d77,scale=rabbit?.56:1;
 ball(body,0,1.04,0,.65,c,.72);body.children.at(-1).scale.z*=1.6;
 ball(body,0,1.48,.69,.38,c,.95);ball(body,0,1.36,1.02,.25,c,.65);
 ball(body,0,1.40,1.22,.10,0x514f45,.7);
 for(const x of[-.2,.2]){ball(body,x,1.57,.94,.048,0x302f2c);if(rabbit){ball(body,x,1.95,.58,.13,c,2.6);}else mesh(body,coneGeo,mat(c),x,1.89,.58,.16,.45,.13);}
 const legs=[];for(const z of[-.50,.45])for(const x of[-.28,.28]){const joint=new T.Group();joint.position.set(x,.84,z);body.add(joint);cyl(joint,0,-.31,0,.075,.64,c);ball(joint,0,-.68,.035,.105,0x71695b,.6);legs.push(joint);}
 if(wolf){const tail=limb(body,[0,1.1,-.80],[0,1.02,-1.45],.16,c);}
 else if(rabbit)ball(body,0,.95,-.85,.21,0xe8e0d0);
 else if(boar)for(const x of[-.21,.21])limb(body,[x,1.22,.93],[x*1.4,1.5,1.11],.055,0xe1d5b9);
 g.scale.setScalar(scale);g.userData.legs=legs;g.userData.body=body;g.userData.species=species;return g;
}
