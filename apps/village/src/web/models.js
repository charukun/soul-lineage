import {THREE} from '@soul/rendering';
import {createMuraModels} from '@soul/rendering/mura';
import {createMuraBuildingVisual} from '@soul/rendering/mura/building-visual';
const models=createMuraModels(THREE,{createCanvas:()=>document.createElement('canvas')});
const T=THREE;
const material=color=>new T.MeshStandardMaterial({color,roughness:.95});
const workMaterials={
 wood:material(0x8c6848),trim:material(0x69563e),leaf:material(0x748b5f),
 gold:material(0xc5a460),stone:material(0x8f9388),cloth:material(0x8d9f91),clay:material(0x9b7d68)
};
function box(g,x,y,z,w,h,d,m){const n=new T.Mesh(new T.BoxGeometry(w,h,d),m);n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;g.add(n);return n;}
function cylinder(g,x,y,z,r,h,m){const n=new T.Mesh(new T.CylinderGeometry(r,r,h,8),m);n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;g.add(n);return n;}
function unscaledDetailRoot(g){
 const n=new T.Group(),safe=v=>Math.abs(v)>1e-6?1/v:1;
 n.scale.set(safe(g.scale.x),safe(g.scale.y),safe(g.scale.z));g.add(n);return n;
}
function decorateWorkSite(g,kind){
 if(!g||g.userData.villageWorkSiteDetailed)return g;
 if(!['logging','storage','wheat','quarry','clay','carpenter','guardpost'].includes(kind))return g;
 g.userData.villageWorkSiteDetailed=true;
 const detail=unscaledDetailRoot(g);
 if(kind==='logging')for(let i=0;i<5;i++){const log=cylinder(detail,-2+(i%2)*.55,.35+Math.floor(i/2)*.5,-1.7+(i%2)*.62,.3,4.4,workMaterials.wood);log.rotation.z=Math.PI/2;}
 if(kind==='storage')for(const [x,z]of[[-2,-1],[0,-1],[2,-1],[-1,1],[1,1]])box(detail,x,.55,z,1.5,1.1,1.5,workMaterials.wood);
 if(kind==='wheat')for(let z=-4;z<=4;z+=1.35)for(let x=-4;x<=4;x+=1.35)cylinder(detail,x,.45,z,.04,.9,workMaterials.gold);
 if(kind==='quarry')for(const [x,z,s]of[[-2,-1,1.1],[1,-1,.9],[2,2,1.3],[-1,2,.7]]){const rock=new T.Mesh(new T.DodecahedronGeometry(s),workMaterials.stone);rock.position.set(x,s*.55,z);rock.castShadow=rock.receiveShadow=true;detail.add(rock);}
 if(kind==='clay'){box(detail,-1,.09,-1.4,7.5,.16,6,workMaterials.clay);for(const [x,z]of[[3.4,-2],[3.4,0],[3.4,2]])cylinder(detail,x,.45,z,.55,.9,workMaterials.clay);}
 if(kind==='carpenter'){box(detail,0,.85,-1,4.5,.45,1.5,workMaterials.wood);for(const x of[-1.7,1.7])box(detail,x,1.7,-1,.18,1.8,.18,workMaterials.cloth);}
 if(kind==='guardpost'){box(detail,0,2.2,0,.22,4.4,.22,workMaterials.wood);box(detail,.65,3.4,0,1.3,.8,.08,workMaterials.cloth);}
 return g;
}

const {mat,prop:baseProp,person:basePerson,interiorShell,floorFor,sailingShip,animal:baseAnimal}=models;
const residentMaterials=new Map();
const residentMaterial=color=>{
 if(!residentMaterials.has(color))residentMaterials.set(color,new T.MeshStandardMaterial({color,roughness:1,metalness:0,flatShading:true}));
 return residentMaterials.get(color);
};
const residentGeometry={
 torso:new T.CylinderGeometry(.28,.40,1,6,1,false),
 head:new T.DodecahedronGeometry(.34,0),
 hair:new T.OctahedronGeometry(.35,0),
 limb:new T.CylinderGeometry(1,1,1,6,1,false),
 detail:new T.BoxGeometry(1,1,1),
 shield:new T.CylinderGeometry(.34,.34,.07,6,1,false),
 cap:new T.ConeGeometry(.36,.30,6,1,false)
};
const residentPalette=[0x6f8972,0xa8735d,0x6c7f96,0xb39a67,0x866f82,0x718982];
const residentHair=[0x4d4138,0x675143,0x3e4542,0x75604b,0x51454c];
const residentSkin=[0xd5b990,0xcda77f,0xe0c49b];
const residentDark=0x554d42;
function residentMesh(g,geo,color,x,y,z,sx=1,sy=1,sz=1){
 const n=new T.Mesh(geo,residentMaterial(color));n.position.set(x,y,z);n.scale.set(sx,sy,sz);n.receiveShadow=true;g.add(n);return n;
}
function residentLimb(g,a,b,r,color){
 const p=new T.Vector3(...a),q=new T.Vector3(...b),n=residentMesh(g,residentGeometry.limb,color,0,0,0,r,p.distanceTo(q),r);
 n.position.copy(p).add(q).multiplyScalar(.5);n.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),q.sub(p).normalize());return n;
}
function rusticProp(kind,seed=1){
 if(!['logseat','logtable'].includes(kind))return baseProp(kind,seed);
 const g=new T.Group(),wood=material(0x8b6847),dark=material(0x654b36);
 if(kind==='logseat'){
  const seat=cylinder(g,0,.53,0,.31,2.05,wood);seat.rotation.z=Math.PI/2;
  for(const x of[-.72,.72]){const leg=cylinder(g,x,.25,.18,.16,.52,dark);leg.rotation.z=.08*(x<0?-1:1);}
 }else{
  for(const z of[-.36,.36]){const top=cylinder(g,0,.86,z,.26,2.25,wood);top.rotation.z=Math.PI/2;}
  for(const x of[-.72,.72])for(const z of[-.35,.35])cylinder(g,x,.42,z,.13,.84,dark);
 }
 return g;
}
function dog(){
 const g=baseAnimal('wolf');
 g.scale.multiplyScalar(.72);
 g.userData.species='dog';
 return g;
}
function prop(kind,seed=1){return rusticProp(kind,seed);}
function animal(species='deer'){return species==='dog'?dog():baseAnimal(species);}
function person(seed=0,monster=false,role='resident'){
 if(monster)return basePerson(seed,true,role);
 const g=new T.Group(),body=new T.Group();g.add(body);
 const variant=Math.abs(Math.floor(Number(seed)||0));
 const cloth=role==='guard'||role==='ranger'?0x607d8d:role==='mayor'?0xa08a5c:role==='player'?0x817290:residentPalette[variant%residentPalette.length];
 const accent=role==='guard'||role==='ranger'?0x9aaca9:role==='mayor'?0xc2a968:new T.Color(cloth).lerp(new T.Color(0xd0bd8c),.22).getHex();
 const skin=residentSkin[variant%residentSkin.length],hair=residentHair[(variant*3+1)%residentHair.length];
 const legs=[];
 for(const x of[-.17,.17]){
  const joint=new T.Group();joint.position.set(x,.72,0);body.add(joint);
  residentMesh(joint,residentGeometry.limb,residentDark,0,-.28,.01,.105,.52,.105);
  legs.push(joint);
 }
 residentMesh(body,residentGeometry.torso,cloth,0,1.08,0,1,.82,1);
 residentMesh(body,residentGeometry.detail,accent,0,.87,.01,.58,.09,.49);
 residentMesh(body,residentGeometry.head,skin,0,1.63,.02,1,.97,.93);
 residentMesh(body,residentGeometry.hair,hair,0,1.82,-.04,1.02,.42,1.02);
 residentLimb(body,[-.31,1.25,0],[-.42,.83,.08],.09,cloth);
 residentLimb(body,[.31,1.25,0],[.42,.83,.08],.09,cloth);
 for(const x of[-.12,.12])residentMesh(body,residentGeometry.detail,0x383631,x,1.64,.302,.035,.026,.018);
 if(role==='guard'||role==='ranger'){
  const shield=residentMesh(body,residentGeometry.shield,0x78919a,-.49,1.05,.14);shield.rotation.x=Math.PI/2;
  residentMesh(body,residentGeometry.detail,0xc6b57f,-.49,1.05,.20,.08,.43,.035);
  residentLimb(body,[.43,.77,.11],[.45,1.72,.17],.027,0xb8b4a4);
 }
 if(role==='mayor'){
  residentMesh(body,residentGeometry.cap,0xb59b60,0,1.96,-.03,1,.85,1);
  residentMesh(body,residentGeometry.detail,0x887352,0,1.10,-.30,.47,.58,.075);
 }
 if(role==='player'){
  residentMesh(body,residentGeometry.detail,0x756684,0,1.12,-.30,.50,.66,.08);
  residentMesh(body,residentGeometry.head,0xd9bd78,0,1.26,.35,.18,.18,.11);
 }
 g.userData.legs=legs;g.userData.body=body;g.userData.residentModel='hoshitsugi-lightweight-v1';
 return g;
}

export {mat,prop,person,interiorShell,floorFor,sailingShip,animal};
export function building(kind,material='base',level=1){return decorateWorkSite(createMuraBuildingVisual(T,models,kind,material,level),kind);}
