import * as THREE from 'three';
import { defs, muraBlocked } from '@soul/world/mura';
import { createMuraModels } from '@soul/rendering/mura';
import { createMuraTerrain, flattenMuraModel } from '@soul/rendering/mura/terrain';

const disposeObject=root=>root.traverse?.(o=>{if(o.geometry?.dispose)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.dispose)m.dispose();});
const ageScale=years=>{
  const rows=[[0,.4],[3,.49],[7,.64],[12,.8],[18,.98],[22,1],[50,1],[65,.985],[80,.955],[90,.935],[100,.91]];
  for(let i=1;i<rows.length;i++)if(years<=rows[i][0]){const[a,x]=rows[i-1],[b,y]=rows[i],t=Math.max(0,Math.min(1,(years-a)/(b-a)));return x+(y-x)*(t*t*(3-2*t));}
  return .91;
};

export function createWorldRenderer({canvas,document:doc,layout,stations}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x91a88b);scene.fog=new THREE.FogExp2(0x9aa895,.0045);
  const camera=new THREE.PerspectiveCamera(43,1,.08,650);camera.position.set(12,13,17);
  scene.add(new THREE.HemisphereLight(0xeef3d9,0x40545b,2.1));
  const sun=new THREE.DirectionalLight(0xffd7a6,2.5);sun.position.set(-12,25,15);scene.add(sun);

  const root=new THREE.Group(),land=new THREE.Group(),objects=new THREE.Group(),stationsRoot=new THREE.Group(),frontRoot=new THREE.Group();root.add(land,objects,stationsRoot);scene.add(root,frontRoot);frontRoot.visible=false;
  const models=createMuraModels(THREE,{createCanvas:()=>doc.createElement('canvas')}),cache=new Map();
  const getProp=kind=>{if(!cache.has('prop:'+kind))cache.set('prop:'+kind,flattenMuraModel(THREE,models.prop(kind,14)));return cache.get('prop:'+kind);};
  const terrain=createMuraTerrain({THREE,scene,outside:land,getProp,mat:models.mat,createCanvas:()=>doc.createElement('canvas')});
  for(const o of layout.objects){
    if(o.phase!=='built')continue;const key=`${o.kind}:${o.material}:${o.level}`;
    if(!cache.has(key))cache.set(key,flattenMuraModel(THREE,defs[o.kind].building?models.building(o.kind,o.material,o.level):models.prop(o.kind)));
    const n=cache.get(key).clone();n.position.set(o.x,.02,o.z);n.rotation.y=o.rot;n.userData.entityId=o.id;objects.add(n);
  }

  function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.08,...extra});}
  function box(parent,size,pos,color){const g=new THREE.BoxGeometry(...size),m=mat(color),mesh=new THREE.Mesh(g,m);mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function cyl(parent,r,h,pos,color,segments=10){const g=new THREE.CylinderGeometry(r,r,h,segments),m=mat(color),mesh=new THREE.Mesh(g,m);mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function blade(parent,length=.9,width=.09,color=0xd8d8cf){const g=new THREE.BoxGeometry(width,length,.055),m=mat(color,{metalness:.6,roughness:.3}),mesh=new THREE.Mesh(g,m);mesh.position.y=length/2+.18;parent.add(mesh);box(parent,[.34,.055,.09],[0,.18,0],0x8c724a);cyl(parent,.045,.3,[0,.03,0],0x5d4532,8);return mesh;}
  function weaponVisual(id,mini=false){const g=new THREE.Group(),s=mini?.58:1;
    if(id==='fist'){cyl(g,.08,.28,[0,.18,0],0x8a7050,8);box(g,[.28,.08,.12],[0,.34,0],0xb69a72);}
    else if(id==='dagger')blade(g,.48,.105);
    else if(id==='sword')blade(g,.9,.09);
    else if(id==='great'){blade(g,1.25,.16);g.scale.x=1.12;}
    else if(id==='spear'){cyl(g,.035,1.55,[0,.78,0],0x775b42,8);const tip=new THREE.Mesh(new THREE.ConeGeometry(.105,.32,6),mat(0xd8d8cf,{metalness:.6,roughness:.3}));tip.position.y=1.72;g.add(tip);}
    else if(id==='axe'){cyl(g,.045,1.15,[0,.58,0],0x775b42,8);box(g,[.38,.34,.08],[.15,1.03,0],0xbfc0b5);}
    else if(id==='staff'){cyl(g,.05,1.5,[0,.75,0],0x72523e,10);const orb=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),mat(0x8aa8a3,{emissive:0x304947,emissiveIntensity:.6}));orb.position.y=1.55;g.add(orb);}
    g.scale.setScalar(s);return g;
  }

  function rack(station){
    const g=new THREE.Group();g.position.set(station.x,0,station.z);g.userData.stationId=station.id;
    box(g,[1.25,.12,.52],[0,.52,0],0x6e5138);box(g,[.12,1.0,.12],[-.5,.52,0],0x59402e);box(g,[.12,1.0,.12],[.5,.52,0],0x59402e);
    if(station.equipment.weapon){const item=weaponVisual(station.equipment.weapon,true);item.position.set(0,.55,.02);item.rotation.z=-.18;g.add(item);}
    if(station.equipment.armor){const color={cloth:0xb68f7f,light:0x7e9090,heavy:0x687477}[station.equipment.armor];box(g,[.66,.62,.18],[0,.87,0],color);}
    if(Object.hasOwn(station.equipment,'shield')){const shield=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.08,12),mat(station.equipment.shield?0x80939d:0x685a4b));shield.rotation.x=Math.PI/2;shield.position.set(0,.82,0);g.add(shield);}
    stationsRoot.add(g);
  }
  stations.filter(s=>s.equipment).forEach(rack);

  const frontGround=new THREE.Mesh(new THREE.PlaneGeometry(17,14),mat(0x827b6a));frontGround.rotation.x=-Math.PI/2;frontRoot.add(frontGround);
  for(const x of[-7.2,7.2])for(let z=-5.5;z<=5.5;z+=2.2)box(frontRoot,[.7,1.2,.7],[x,.6,z],0x5f655e);
  for(const x of[-2.2,0,2.2])box(frontRoot,[1.4,.25,.7],[x,.12,-6.25],0x786a5b);
  const rescuePad=new THREE.Mesh(new THREE.RingGeometry(.8,1.0,32),new THREE.MeshBasicMaterial({color:0xb5c9bc,side:THREE.DoubleSide}));rescuePad.rotation.x=-Math.PI/2;rescuePad.position.set(0,.03,5.2);frontRoot.add(rescuePad);
  const enemyMeshes=new Map();
  function syncFront(front){
    const liveIds=new Set((front?.enemies||[]).map(e=>e.id));for(const[id,node]of enemyMeshes)if(!liveIds.has(id)){node.removeFromParent();disposeObject(node);enemyMeshes.delete(id);}
    for(const enemy of front?.enemies||[]){let node=enemyMeshes.get(enemy.id);if(!node){node=models.person(enemy.id.length+11,true,'resident');node.scale.setScalar(front?.stage>=5?1.35:1.05);enemyMeshes.set(enemy.id,node);frontRoot.add(node);}node.position.set(enemy.x,0,enemy.z);node.visible=!enemy.dead;const body=node.userData.body;if(body)body.rotation.z=enemy.flash?Math.sin(elapsed*30)*.08:0;}
  }

  const hero=models.person(5,false,'player');hero.name='Player';scene.add(hero);
  const mother=models.person(23,false,'resident');mother.name='Mother';scene.add(mother);
  const equipmentRoot=new THREE.Group();hero.add(equipmentRoot);let equipmentKey='';
  function syncEquipment(equipment){
    const key=JSON.stringify(equipment);if(key===equipmentKey)return;equipmentKey=key;
    for(const child of [...equipmentRoot.children]){equipmentRoot.remove(child);disposeObject(child);}
    const armor=equipment.armor;
    if(armor!=='cloth'){
      const c=armor==='heavy'?0x69747b:0x839493;
      box(equipmentRoot,[.82,.72,.28],[0,1.05,-.02],c);
      box(equipmentRoot,[.24,.18,.34],[-.47,1.28,0],c);box(equipmentRoot,[.24,.18,.34],[.47,1.28,0],c);
      if(armor==='heavy')box(equipmentRoot,[.72,.18,.34],[0,.72,0],0x59636a);
    }
    if(equipment.weapon!=='fist'){
      const w=weaponVisual(equipment.weapon);w.position.set(.48,.60,.12);w.rotation.set(.1,0,-.2);equipmentRoot.add(w);
    }
    if(equipment.shield){const shield=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.09,14),mat(0x78919c,{metalness:.35,roughness:.48}));shield.rotation.x=Math.PI/2;shield.position.set(-.48,1.04,.18);equipmentRoot.add(shield);}
  }

  const target=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),camOffset=new THREE.Vector3(10.5,11.5,14.5);let elapsed=0;
  function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function cameraVector(axis){
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    return new THREE.Vector3().addScaledVector(right,axis.x).addScaledVector(forward,-axis.y).normalize();
  }
  function canMoveTo(x,z,radius=.32,zone='village'){if(zone==='frontier')return Math.abs(x)<7.15-radius&&z>-6.45+radius&&z<6.1-radius;return !muraBlocked(layout,x,z,radius);}
  function renderState(state,dt=0){
    elapsed+=dt;syncEquipment(state.equipment);const s=ageScale(state.ageYears),birth=state.phase==='birth',village=state.zone==='village';root.visible=village;frontRoot.visible=!village;
    hero.scale.setScalar(s);hero.rotation.y=state.yaw;mother.rotation.y=state.yaw;
    if(birth&&village){mother.visible=true;mother.position.set(state.position.x,0,state.position.z);hero.position.set(state.position.x+Math.sin(state.yaw)*.24,1.02,state.position.z+Math.cos(state.yaw)*.24);}
    else{mother.visible=false;hero.position.set(state.position.x,0,state.position.z);}
    const legs=hero.userData.legs||[];if(state.moving)legs.forEach((leg,i)=>leg.rotation.x=Math.sin(elapsed*8+(i%2)*Math.PI)*.48);else legs.forEach(leg=>leg.rotation.x*=.72);
    const body=hero.userData.body;if(body)body.rotation.z=Math.sin(elapsed*1.4)*.012;
    target.set(state.position.x,1.15,state.position.z);const desired=target.clone().add(camOffset);camera.position.lerp(desired,1-Math.pow(.001,Math.min(.05,dt||.016)));camera.lookAt(target);
    if(village){terrain.waterMat.uniforms.time.value=elapsed;terrain.motes.position.y=Math.sin(elapsed*.35)*.15;}
    renderer.render(scene,camera);
  }
  function dispose(){observer.disconnect();disposeObject(hero);disposeObject(mother);root.removeFromParent();frontRoot.removeFromParent();hero.removeFromParent();mother.removeFromParent();for(const v of cache.values())disposeObject(v);for(const n of enemyMeshes.values())disposeObject(n);renderer.dispose();}
  return{THREE,scene,camera,renderState,cameraVector,canMoveTo,syncEquipment,syncFront,resize,dispose};
}
