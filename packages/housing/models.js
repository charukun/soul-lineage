import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PALETTES,ITEMS} from './catalog.js';
const materials=new Map();
export const mat=(c,opts={})=>{const key=c+JSON.stringify(opts);if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color:c,roughness:.86,...opts}));return materials.get(key);};
const wood='#785741',darkwood='#594a3f',cream='#eadebe',stone='#a3a294',gold='#d4b570',glass='#ffc984';
export function mesh(g,geom,m,x=0,y=0,z=0){const o=new T.Mesh(geom,typeof m==='string'?mat(m):m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
export const box=(g,w,h,d,c,x=0,y=0,z=0)=>mesh(g,new T.BoxGeometry(w,h,d),c,x,y,z);
export const sphere=(g,r,c,x=0,y=0,z=0,s=1)=>{const o=mesh(g,new T.IcosahedronGeometry(r,1),c,x,y,z);o.scale.y=s;return o;};
export const cyl=(g,rt,rb,h,c,x=0,y=0,z=0,n=12)=>mesh(g,new T.CylinderGeometry(rt,rb,h,n),c,x,y,z);
export function beam(g,a,b,r,c=wood){const p=new T.Vector3(...a),q=new T.Vector3(...b),o=cyl(g,r,r,q.distanceTo(p),c);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return o;}
export function torus(g,r,t,c,x=0,y=0,z=0){return mesh(g,new T.TorusGeometry(r,t,6,32),c,x,y,z);}
const rand=(a)=>{const s=Math.sin(a*127.13+47.11)*43758.54;return s-Math.floor(s);};
function roof(g,w,d,y,h,palette=0){
 const c=PALETTES[palette].roof;
 const geo=new T.BufferGeometry();const positions=[-w/2,y,-d/2,w/2,y,-d/2,0,y+h,-d/2,-w/2,y,d/2,0,y+h,d/2,w/2,y,d/2];geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();mesh(g,geo,PALETTES[palette].wall);
 const len=Math.hypot(w/2,h),pitch=Math.atan2(h,w/2),rows=5,cols=Math.ceil(d/.33);
 for(const sign of [-1,1]){const panel=box(g,len,.1,d,c,sign*w/4,y+h/2,0);panel.rotation.z=-sign*pitch;
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
   const u=(i+.5)/rows,xx=sign*(w/2)*(1-u),yy=y+h*u+.055,zz=-d/2+(j+.5)*d/cols;
   const cc=new T.Color(c).multiplyScalar(.90+Math.floor(rand(i*19+j+palette*55)*3)*.1);
   const tile=box(g,len/rows+.06,.065,d/cols-.018,mat('#'+cc.getHexString()),xx,yy,zz);tile.rotation.z=-sign*pitch;
  }
 }
 beam(g,[0,y+h+.06,-d/2-.03],[0,y+h+.06,d/2+.03],.085,c);
 for(const z of [-d/2-.025,d/2+.025]){beam(g,[-w/2,y,z],[0,y+h+.06,z],.06,darkwood);beam(g,[0,y+h+.06,z],[w/2,y,z],.06,darkwood);}
}
function windowFrame(g,x,y,z,size=.48,side=false){const a=new T.Group();g.add(a);a.position.set(x,y,z);if(side)a.rotation.y=Math.PI/2;
 box(a,size+.16,size+.17,.1,wood,0,0,0);box(a,size,size,.115,mat(glass,{emissive:glass,emissiveIntensity:.3}),0,0,.02);
 box(a,.043,size,.125,wood,0,0,.08);box(a,size,.045,.125,wood,0,0,.08);
 for(const sign of [-1,1]){box(a,.15,size+.11,.08,PALETTES[2].roof,sign*(size/2+.14),0,.04);for(let j=0;j<3;j++)box(a,.17,.025,.12,'#93a48b',sign*(size/2+.14),-.14+j*.12,.05);}
 box(a,size+.25,.08,.24,wood,0,-size/2-.13,.02);
 flowerbox(a,0,-size/2-.18,.1,size+.1);
}
function flowerbox(g,x,y,z,w=.7){box(g,w,.15,.23,wood,x,y,z);for(let j=0;j<5;j++){const q=x-w*.38+j*w*.18;sphere(g,.095,'#648267',q,y+.13,z,.7);sphere(g,.065,j%2?'#e7ba97':'#d48699',q+.025,y+.22,z+.02);}}
function door(g,x,y,z){box(g,.58,1.05,.08,darkwood,x,y+.52,z);box(g,.49,.92,.105,'#93754e',x,y+.5,z+.01);for(let j=0;j<3;j++)box(g,.018,.9,.115,wood,x-.18+j*.18,y+.5,z+.02);sphere(g,.04,gold,x+.15,y+.47,z+.09);box(g,.77,.12,.45,stone,x,y-.02,z+.15);}
function stonebase(g,w,d){box(g,w+.2,.28,d+.2,stone,0,.13,0);for(let j=0;j<Math.ceil(w/.36);j++)box(g,.3,.2,.12,j%3?'#b6b09f':'#908e81',-w/2+.14+j*.36,.14,d/2+.05);}
function house(g,type,p=0,f=1){
 let w=2.45,d=2.15;if(type==='manor'){w=3.7;d=2.5;}if(type==='tallhouse')w=2;
 const y=1.5+(f-1)*1.03,c=PALETTES[p];stonebase(g,w,d);box(g,w,y,d,c.wall,0,.28+y/2,0);
 for(const x of [-w/2+.04,w/2-.04])for(const z of [-d/2+.01,d/2+.01])box(g,.11,y+.02,.12,darkwood,x,.28+y/2,z);
 for(let j=0;j<f;j++){const yy=.53+j*1.03;box(g,w+.08,.11,d+.1,wood,0,yy-.12,0);if(j>0){windowFrame(g,-w*.23,yy+.42,d/2,.43);windowFrame(g,w*.23,yy+.42,d/2,.43);}windowFrame(g,w/2,yy+.47,0,.44,true);}
 roof(g,w+.48,d+.48,y+.31,.95,p);door(g,-w*.2,.29,d/2+.06);windowFrame(g,w*.26,.99,d/2+.08,.46);
 const attic=torus(g,.185,.045,gold,0,y+.61,d/2+.09);cyl(g,.16,.16,.07,mat(glass,{emissive:glass,emissiveIntensity:.22}),0,y+.61,d/2+.07).rotation.x=Math.PI/2;
 box(g,.37,1,.38,stone,-w*.29,y+.9,-d*.24);box(g,.47,.13,.47,'#d1c5ae',-w*.29,y+1.4,-d*.24);
 if(type==='manor'){const annex=new T.Group();annex.position.set(w*.3,.2,-.2);roof(annex,1.45,2.8,y+.4,.72,(p+1)%6);g.add(annex);}
 if(type==='bakery'){
  const canopy=new T.Group();canopy.position.set(0,1.45,d/2+.44);canopy.rotation.x=.22;
  for(let j=0;j<8;j++){box(canopy,w/8,.075,.95,j%2?'#efe0ba':c.roof,-w/2+w/16+j*w/8,0,0);sphere(canopy,w/16,j%2?'#efe0ba':c.roof,-w/2+w/16+j*w/8,-.05,.45,.9);}g.add(canopy);
  box(g,1.35,.48,.5,wood,.3,.6,d/2+.65);for(let j=0;j<5;j++){const b=sphere(g,.14,'#d3a061',-.23+j*.23,.95,d/2+.65,.6);b.scale.x=1.2;}
 }
 if(type==='windmill'){
  const rot=new T.Group();rot.position.set(0,y+.6,d/2+.32);rot.userData.spin=.22;g.add(rot);
  cyl(rot,.19,.19,.25,wood).rotation.x=Math.PI/2;
  for(let j=0;j<4;j++){const sail=new T.Group();sail.rotation.z=j*Math.PI/2+.35;beam(sail,[0,.1,0],[0,2.2,0],.055,wood);box(sail,.58,1.2,.055,cream,.25,1.47,0);for(let k=0;k<5;k++)box(sail,.65,.025,.07,wood,.25,.96+k*.23,0);rot.add(sail);}
 }
}
function roundHouse(g,type,p,f=1){const c=PALETTES[p],mush=type==='mushroom',extra=(f-1)*1.05,h=1.75+extra;stonebase(g,2,2);cyl(g,mush?.8:1.12,mush?1.02:1.15,h,c.wall,0,.225+h/2,0,16);
 if(mush){sphere(g,1.75,c.roof,0,2.15+extra,0,.55);for(let j=0;j<14;j++){const a=j*2.4,rr=.25+rand(j)*1.2;const x=Math.cos(a)*rr,z=Math.sin(a)*rr,y=2.15+extra+Math.sqrt(1-rr*rr/3.06)*.99;sphere(g,.12+rand(j+5)*.13,cream,x,y,z,.2);}}
 else{cyl(g,.05,1.64,1.5,c.roof,0,2.62+extra,0,18);for(let j=0;j<5;j++){const r=1.64-j*.27;const ring=torus(g,r,.035,mat('#'+new T.Color(c.roof).multiplyScalar(.78).getHexString()),0,1.89+extra+j*.25);ring.rotation.x=Math.PI/2;}sphere(g,.105,gold,0,3.45+extra,0);}
 door(g,0,.28,1.04);windowFrame(g,-.76,1.23,.83,.36);for(let floor=1;floor<f;floor++){const ring=torus(g,mush?.91:1.135,.045,wood,0,1.74+(floor-1)*1.05,0);ring.rotation.x=Math.PI/2;windowFrame(g,0,1.23+floor*1.05,mush?.86:1.12,.44);}
}
export function tree(g,type='tree',seed=1,scale=1){
 const blossom=type==='blossom',pine=type==='pine';const trunk=blossom?'#876853':wood;
 beam(g,[0,0,0],[.09,2.2,0],.16,trunk);for(let j=0;j<3;j++){const a=j*2.3+seed;beam(g,[0,.9+j*.2,0],[Math.cos(a)*.8,1.7+j*.15,Math.sin(a)*.8],.075,trunk);}
 if(pine){for(let j=0;j<4;j++)cyl(g,.06,1.05-j*.17,1.12,['#56776e','#648777','#779585','#8ca58b'][j],0,1.25+j*.43,0,9);}
 else{const cs=blossom?['#ce8f9f','#e6b5b6','#f0c9c1','#d9a6b0']:['#5e8b69','#749972','#8eae7f','#aac18b'];for(let j=0;j<15;j++){const a=j*2.399;const r=Math.sqrt(j/15)*.93;const y=2.0+Math.sin(j*1.7)*.23+.6*(1-r);sphere(g,.57+rand(j+seed)*.26,cs[j%4],Math.cos(a)*r,y,Math.sin(a)*r,.85);}}
 for(let j=0;j<3;j++)sphere(g,.24,'#6d8c69',Math.cos(j*2.1)*.2,.16,Math.sin(j*2.1)*.2,.5);
 g.scale.setScalar(scale);
}
function flowers(g,seed=1){
 for(let j=0;j<10;j++){const x=(rand(j+seed)-.5)*.85,z=(rand(j*5+seed)-.5)*.85,h=.15+rand(j*3+2)*.22;beam(g,[x,0,z],[x,h,z],.012,'#758668');sphere(g,.073,['#dc929e','#ecd49d','#f1e5d5'][j%3],x,h,z,.5);sphere(g,.028,'#efc674',x,h+.025,z);const leaf=sphere(g,.055,'#729164',x+.04,h*.55,z,.4);leaf.scale.x=2;}
}
function lamp(g,floating=false){
 if(!floating){beam(g,[0,0,0],[0,1.85,0],.045,darkwood);beam(g,[0,1.85,0],[.27,1.85,0],.037,darkwood);cyl(g,.12,.2,.2,stone,0,.1,0);}
 const y=floating?2.3:1.58,x=floating?0:.27;
 const a=new T.Group();a.position.set(x,y,0);if(floating)a.userData.float=true;g.add(a);cyl(a,.18,.12,.32,mat('#ffdda1',{emissive:'#ffc571',emissiveIntensity:.9}),0,0,0,6);cyl(a,.05,.23,.16,wood,0,.22,0,6);cyl(a,.2,.1,.12,wood,0,-.21,0,6);torus(a,.06,.015,gold,0,.34,0);
}
function furniture(g,type,p){
 if(type==='bed'){box(g,1.5,.32,2,wood,0,.27,0);box(g,1.46,.2,1.9,'#eee4d1',0,.53,0);box(g,1.47,.17,1.35,PALETTES[p].roof,0,.66,.27);box(g,1.6,.9,.13,wood,0,.52,-.99);box(g,1.6,.48,.14,wood,0,.34,.98);for(const x of [-.4,.4]){const pillow=sphere(g,.36,'#f6ecdb',x,.74,-.64,.32);pillow.scale.z=.64;}for(let j=0;j<5;j++)box(g,.055,.025,1.23,'#d7b8a2',-.58+j*.28,.756,.25);}
 if(type==='sofa'){box(g,1.9,.3,.8,wood,0,.3,0);box(g,1.86,.55,.2,PALETTES[p].roof,0,.73,-.36);for(const x of [-.85,.85])box(g,.21,.47,.81,PALETTES[p].roof,x,.55,0);for(const x of [-.41,.41]){box(g,.72,.17,.65,PALETTES[p].roof,x,.56,.03);sphere(g,.21,'#dfc895',x,.74,-.1,.6);}}
 if(type==='table'){cyl(g,.62,.65,.12,wood,0,.77,0,24);cyl(g,.07,.11,.7,darkwood,0,.36,0);for(let j=0;j<3;j++){const a=j*2.094;beam(g,[0,.2,0],[Math.cos(a)*.45,.04,Math.sin(a)*.45],.07,wood);}cyl(g,.13,.15,.05,cream,.18,.87,0);cyl(g,.08,.055,.14,cream,-.13,.92,0);sphere(g,.025,'#b486a5',-.13,1.1,0);}
 if(type==='chair'){box(g,.56,.1,.55,wood,0,.5,0);box(g,.55,.47,.08,wood,0,.77,-.25);for(const x of [-.22,.22])for(const z of [-.22,.22])box(g,.065,.49,.065,wood,x,.23,z);box(g,.46,.07,.43,'#87967a',0,.58,0);}
 if(type==='shelf'||type==='cabinet'){const h=type==='shelf'?1.8:.85;for(const x of [-.78,.78])box(g,.12,h,.52,wood,x,h/2,0);box(g,1.48,h,.065,darkwood,0,h/2,-.24);for(let j=0;j<(type==='shelf'?3:2);j++){const y=.14+j*(h-.15)/3;box(g,1.67,.065,.6,wood,0,y,.05);if(type==='shelf'){for(let k=0;k<9;k++){const col=['#98829e','#9f6e6c','#87967a','#c4ad7a','#709096'][k%5];box(g,.1,.29+rand(k+j)*.16,.26,col,-.67+k*.15,y+.22,.07);}}else{box(g,1.35,.22,.08,'#b89363',0,y+.15,.28);sphere(g,.035,gold,0,y+.15,.35);}}box(g,1.72,.12,.63,wood,0,h,.06);}
 if(type==='rug'){box(g,2.5,.025,1.75,PALETTES[p].roof,0,.025,0);for(const x of [-1.16,1.16])box(g,.055,.008,1.6,'#e3d4ab',x,.04,0);for(const z of [-.76,.76])box(g,2.37,.01,.04,'#e3d4ab',0,.04,z);const r=torus(g,.37,.024,'#e2cf9f',0,.05);r.rotation.x=Math.PI/2;for(let j=0;j<10;j++){box(g,.018,.02,.1,cream,-1.13+j*.25,.035,.91);box(g,.018,.02,.1,cream,-1.13+j*.25,.035,-.91);}}
 if(type==='stove'){box(g,1.3,1.15,.64,stone,0,.57,0);box(g,.87,.72,.67,darkwood,0,.47,.05);box(g,1.48,.11,.83,cream,0,1.17,0);cyl(g,.17,.2,.85,stone,0,1.57,-.16);beam(g,[-.3,.16,.4],[.3,.16,.4],.08,wood);for(let j=0;j<3;j++)sphere(g,.14,mat('#efaf66',{emissive:'#ff8e3f',emissiveIntensity:1.3}),-.2+j*.2,.24,.36,1.7);}
 if(type==='pot'){cyl(g,.23,.15,.4,'#b77c66',0,.2,0,10);cyl(g,.25,.25,.06,'#cd967a',0,.41,0,10);for(let j=0;j<5;j++){const a=j*2.399;beam(g,[0,.4,0],[Math.cos(a)*.22,.85+rand(j)*.18,Math.sin(a)*.22],.015,'#678364');const l=sphere(g,.14,'#84a17b',Math.cos(a)*.19,.79+rand(j)*.18,Math.sin(a)*.19,1.4);}}
 if(type==='cushion'){const c=sphere(g,.4,PALETTES[p].roof,0,.17,0,.38);c.rotation.y=.6;}
 if(type==='floorlamp'){beam(g,[0,.04,0],[0,1.35,0],.025,gold);cyl(g,.19,.27,.06,wood,0,.035,0);cyl(g,.2,.37,.38,mat(cream,{emissive:'#e3aa64',emissiveIntensity:.25}),0,1.41,0,14);}
 if(type==='piano'){box(g,1.7,1.14,.58,darkwood,0,.64,-.08);box(g,1.67,.12,.85,wood,0,1.25,-.04);box(g,1.57,.09,.38,cream,0,.76,.35);for(let i=0;i<15;i++)box(g,.035,.01,.35,darkwood,-.7+i*.1,.815,.35);for(let i=0;i<10;i++)box(g,.052,.04,.19,darkwood,-.69+i*.15,.84,.25);}
}
export function makeModel(type,palette=0,floors=1,{optimize=true}={}){
 const g=new T.Group();const c=PALETTES[palette%6];
 if(['cottage','tallhouse','manor','bakery','windmill'].includes(type))house(g,type,palette,floors);
 else if(['roundhouse','mushroom'].includes(type))roundHouse(g,type,palette,floors);
 else if(type==='greenhouse'){
  stonebase(g,2.6,2.3);box(g,2.6,1.5,2.3,mat('#a2c6bd',{transparent:true,opacity:.52,roughness:.24,metalness:.05}),0,1,0);for(const x of [-1.3,0,1.3])for(const z of [-1.15,1.15])beam(g,[x,.2,z],[x,1.8,z],.045,cream);for(const z of [-1.15,0,1.15]){beam(g,[-1.3,1.8,z],[0,2.7,z],.05,cream);beam(g,[0,2.7,z],[1.3,1.8,z],.05,cream);}for(const x of [-1.3,1.3])beam(g,[x,1.8,-1.15],[x,1.8,1.15],.045,cream);beam(g,[0,2.7,-1.15],[0,2.7,1.15],.045,cream);door(g,0,.26,1.16);for(let j=0;j<4;j++){const a=new T.Group();a.position.set(-.8+j*.5,.2,-.5);furniture(a,'pot',2);g.add(a);}
 }
 else if(['tree','pine','blossom'].includes(type))tree(g,type,3);
 else if(type==='flower')flowers(g);
 else if(type==='hedge'){for(let j=0;j<4;j++)sphere(g,.35,'#6c916d',-.45+j*.3,.38,0,1.2);}
 else if(type==='rock'){const o=sphere(g,.6,'#989b8b',0,.27,0,.6);o.rotation.y=.5;sphere(g,.26,'#738c6d',-.2,.52,.1,.25);}
 else if(type==='garden'){box(g,1.65,.15,1.65,'#7f654b',0,.075,0);for(const x of [-.82,.82])box(g,.075,.2,1.73,wood,x,.1,0);for(const z of [-.82,.82])box(g,1.73,.2,.075,wood,0,.1,z);for(let x=0;x<3;x++)for(let z=0;z<3;z++){const xx=-.53+x*.53,zz=-.5+z*.51;sphere(g,.18,'#8aaa67',xx,.25,zz,.55);for(let j=0;j<3;j++){const l=sphere(g,.115,j%2?'#85a568':'#b7b67b',xx+(j-1)*.09,.33,zz,.5);l.rotation.z=j;}}}
 else if(type==='lamp'||type==='lantern')lamp(g,type==='lantern');
 else if(type==='bench'){box(g,1.65,.11,.52,wood,0,.48,0);for(const x of [-.61,.61]){box(g,.1,.46,.42,darkwood,x,.22,0);beam(g,[x,.45,-.22],[x,.94,-.29],.04,darkwood);}for(let j=0;j<2;j++)box(g,1.7,.13,.09,wood,0,.71+j*.17,-.29);}
 else if(type==='fountain'||type==='well'){
  const well=type==='well',r=well?.62:1.08;cyl(g,r+.15,r+.18,.12,stone,0,.06,0,20);cyl(g,r,r,.32,stone,0,.25,0,20);cyl(g,r-.1,r-.1,.035,mat('#85bdb7',{metalness:.15,roughness:.18}),0,.43,0,24);
  if(well){for(const x of [-.64,.64])beam(g,[x,.2,0],[x,1.95,0],.055,wood);roof(g,1.7,1.35,1.93,.53,palette);beam(g,[-.7,1.55,0],[.7,1.55,0],.06,wood);beam(g,[0,1.6,0],[0,.63,0],.011,'#b1a17d');cyl(g,.13,.1,.2,wood,0,.66,0);}
  else{cyl(g,.14,.27,1,stone,0,.75,0);cyl(g,.55,.19,.15,cream,0,1.28,0,20);cyl(g,.49,.49,.025,'#a3d2cd',0,1.37,0,20);sphere(g,.19,mat('#b1dad2',{emissive:'#6baaa9',emissiveIntensity:.18}),0,1.53,0);for(let j=0;j<7;j++){const a=j*.898;beam(g,[Math.cos(a)*.48,1.36,Math.sin(a)*.48],[Math.cos(a)*.72,.5,Math.sin(a)*.72],.014,'#b6d9d6');}}
 }
 else if(type==='market'){
  box(g,2.15,.68,.95,wood,0,.38,0);for(const x of [-1.1,1.1])for(const z of [-.53,.53])beam(g,[x,.1,z],[x,1.95,z],.05,wood);
  for(let j=0;j<10;j++){const a=box(g,.23,.08,1.6,j%2?cream:c.roof,-1.05+j*.233,1.85,0);a.rotation.x=-.08;}
  for(let j=0;j<3;j++){box(g,.58,.13,.66,'#b9986c',-.7+j*.7,.8,.06);for(let k=0;k<5;k++)sphere(g,.105,['#b87e6a','#dab569','#8eaa6f'][j],-.88+j*.7+(k%3)*.15,.99,Math.floor(k/3)*.2-.1);}
 }
 else if(type==='bridge'){
  for(let j=0;j<15;j++){const x=-1.5+j*3/14,y=.32+.42*Math.sin(j/14*Math.PI);box(g,.22,.1,1.7,wood,x,y,0);for(const z of [-.86,.86]){if(j%3===0)beam(g,[x,y,z],[x,y+.7,z],.045,darkwood);if(j<14){const nx=x+3/14,ny=.32+.42*Math.sin((j+1)/14*Math.PI);beam(g,[x,y+.58,z],[nx,ny+.58,z],.04,cream);}}}
 }
 else if(type==='fence'){for(const x of [-.46,.46]){box(g,.09,.66,.09,cream,x,.33,0);cyl(g,0,.085,.12,cream,x,.72,0,4);}box(g,1,.08,.07,cream,0,.24,0);box(g,1,.08,.07,cream,0,.51,0);}
 else if(type==='path'){for(let j=0;j<5;j++){const o=cyl(g,.19+rand(j)*.055,.22,.045,['#d6d0b9','#e0d7be','#c3c3ac'][j%3],(rand(j+4)-.5)*.64,.04,(rand(j+9)-.5)*.64,6);o.rotation.y=rand(j)*6;}}
 else if(type==='woodpath'){for(let j=0;j<4;j++)box(g,.81,.065,.18,j%2?'#baa383':'#c9b594',0,.05,-.31+j*.21);}
 else if(type==='pond'){
  const w=cyl(g,1.14,1.16,.05,mat('#76afb0',{roughness:.14,metalness:.14}),0,.08,0,32);w.scale.z=.8;
  for(let j=0;j<20;j++){const a=j*Math.PI/10;sphere(g,.15+rand(j)*.1,'#b8b6a3',Math.cos(a)*1.13,.15,Math.sin(a)*.89,.52);}
  for(let j=0;j<3;j++){cyl(g,.15,.15,.015,'#7a9b75',-.5+j*.4,.13,Math.sin(j)*.45,9);sphere(g,.065,'#e8b6b4',-.5+j*.4,.19,Math.sin(j)*.45,.65);}
 }
 else if(type==='crystal'){for(let j=0;j<4;j++){const h=.5+rand(j)*.6,xx=(j-1.5)*.19,zz=Math.sin(j)*.18;cyl(g,0,.13,h*.3,mat('#b1e1d6',{emissive:'#529f9d',emissiveIntensity:.22,metalness:.1}),xx,h*.85,zz,5);cyl(g,.13,.13,h*.7,'#92bfc2',xx,h*.35,zz,5);}}
 else if(type==='portal'){
  torus(g,1.06,.12,stone,0,1.37,0);const rr=torus(g,.89,.025,mat('#b4ebe4',{emissive:'#87d3ce',emissiveIntensity:1.2}),0,1.37,.03);box(g,2.5,.17,1,stone,0,.08,0);for(let j=0;j<8;j++){const a=j*Math.PI/4;sphere(g,.07,gold,Math.cos(a)*1.07,1.37+Math.sin(a)*1.07,.12);}
 }
 else if(type==='arch'||type==='gazebo'){
  if(type==='gazebo'){cyl(g,1.45,1.55,.16,stone,0,.08,0,8);for(let j=0;j<6;j++){const a=j*Math.PI/3;beam(g,[Math.cos(a)*1.2,.1,Math.sin(a)*1.2],[Math.cos(a)*1.2,2,Math.sin(a)*1.2],.065,cream);}cyl(g,.1,1.7,1,c.roof,0,2.42,0,6);sphere(g,.1,gold,0,3,0);}
  else{for(const x of [-1,1])beam(g,[x,0,0],[x,1.75,0],.05,cream);const curve=new T.EllipseCurve(0,1.75,1,.65,0,Math.PI,false);const pts=curve.getPoints(20).map(p=>new T.Vector3(p.x,p.y,0));mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.055,6,false),cream);for(let j=0;j<13;j++){const a=j*Math.PI/12;sphere(g,.14,j%3?'#94a583':'#dda3b0',Math.cos(a),1.75+Math.sin(a)*.65,0,.8);}}
 }
 else if(type==='telescope'){for(let j=0;j<3;j++){const a=j*Math.PI*2/3;beam(g,[0,.94,0],[Math.cos(a)*.48,0,Math.sin(a)*.48],.035,wood);}beam(g,[-.46,1.08,0],[.48,1.48,0],.115,gold);beam(g,[.4,1.45,0],[.54,1.51,0],.15,darkwood);}
 else if(ITEMS[type]?.indoor)furniture(g,type,palette);
 else if(type==='raise'||type==='lower'){sphere(g,1,'#91aa7d',0,.1,0,type==='raise'?.5:.18);}
 else if(type==='erase'){box(g,.7,.4,.45,'#d1c0a6',0,.2,0);}
 if(type==='greenhouse')g.scale.y=1+(floors-1)*.3;if(optimize)return optimizeGroup(g);return g;
}
export function optimizeGroup(group){
 group.updateMatrixWorld(true);const buckets=new Map(),animated=[];
 group.traverse(o=>{if(o.userData.spin||o.userData.float)animated.push(o);});
 const protectedMesh=o=>{let p=o;while(p&&p!==group){if(p.userData.spin||p.userData.float)return true;p=p.parent;}return false;};
 group.traverse(o=>{if(!o.isMesh||protectedMesh(o))return;const key=o.material.uuid;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const key of Object.keys(geo.attributes))if(!['position','normal'].includes(key))geo.deleteAttribute(key);if(geo.index)geo.setIndex(geo.index.clone());if(!buckets.has(key))buckets.set(key,{geos:[],material:o.material});buckets.get(key).geos.push(geo);});
 const result=new T.Group();for(const {geos,material} of buckets.values()){let merged;try{merged=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g),false);}catch{}if(merged){const m=mesh(result,merged,material);for(const geo of geos)geo.dispose();}}
 for(const obj of animated){const source=obj.clone(true);source.position.set(0,0,0);source.quaternion.identity();source.scale.setScalar(1);source.userData={};const a=optimizeGroup(source);a.userData={...obj.userData};obj.getWorldPosition(a.position);obj.getWorldQuaternion(a.quaternion);obj.getWorldScale(a.scale);result.add(a);}return result;
}
export function makeResident(index=0){
 const g=new T.Group(),body=new T.Group();g.add(body);g.userData.body=body;const colors=['#b77583','#769284','#8698b5','#b79f6a','#83977c','#a288a7'],color=colors[index%6];
 const head=sphere(body,.155,'#e9c9ac',0,.68,0,1.03);sphere(body,.168,['#846349','#d6bd8f','#544e4b'][index%3],0,.748,-.025,.65);
 for(const x of [-.06,.06])sphere(body,.017,'#4f4943',x,.69,.14,.9);
 cyl(body,.14,.2,.32,color,0,.4,0,8);cyl(body,.085,.085,.065,'#eacaae',0,.58,0,8);
 const legs=[],arms=[];for(const sign of [-1,1]){const a=new T.Group();a.position.set(sign*.085,.28,0);beam(a,[0,0,0],[0,-.21,.025],.046,'#675c52');box(a,.095,.065,.15,darkwood,0,-.225,.045);body.add(a);legs.push(a);
 const arm=new T.Group();arm.position.set(sign*.155,.5,0);beam(arm,[0,0,0],[sign*.04,-.19,.02],.04,color);sphere(arm,.044,'#e9c9ac',sign*.04,-.2,.02);body.add(arm);arms.push(arm);}
 g.userData.legs=legs;g.userData.arms=arms;if(index===0){cyl(body,.27,.27,.04,'#cebc8c',0,.84,0,14);cyl(body,.12,.18,.12,'#cfbd8e',0,.9,0,12);}
 return g;
}
export function makeInterior(palette=0){
 const g=new T.Group();box(g,8.35,.35,7,wood,0,-.22,0);for(let j=0;j<24;j++)box(g,8.1,.04,.275,j%3?'#c9b695':'#d7c4a3',0,-.025,-3.25+j*.28);
 box(g,8.25,2.8,.16,PALETTES[palette].wall,0,1.3,-3.45);box(g,.16,2.8,7,PALETTES[palette].wall,-4.13,1.3,0);
 for(const x of [-4,0,4])box(g,.1,2.8,.13,wood,x,1.3,-3.33);for(const y of [.05,2.67]){box(g,8.2,.11,.16,wood,0,y,-3.32);box(g,.16,.11,6.8,wood,-4.02,y,0);}
 for(const x of [-2,2])windowFrame(g,x,1.6,-3.32,.96);
 for(let j=0;j<9;j++)box(g,8.1,.045,.018,'#baaa8d',0,.005,-3.25+j*.84);return optimizeGroup(g);
}
