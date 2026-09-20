// Native NOCTURNE battle runtime for Visual Review Lab battle presentation 2.
// Source: apps/nocturne on astra/reference-apps-nocturne-eclipse-20260920.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const NOCTURNE_ASSET_ORIGIN='https://nocturne-autobattle.c-okamoto.workers.dev/';
const $ = id => document.getElementById(id), V = THREE.Vector3, TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
let seed = 73917;
function rand() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
const randRange = (a,b) => a + (b-a)*rand();
const show = (id,on=true) => $(id).classList.toggle('hidden',!on);
const trace = [];
function record(type,data={}) { trace.push({type,time:Math.round(game.time*100)/100,...data}); if(trace.length>160)trace.shift(); }
const game = {phase:'loading',time:0,wave:0,spawned:0,waveCount:0,spawnTimer:0,kills:0,damage:0,received:0,bursts:0,stance:'balanced',speed:1,energy:0,level:1,upgradeTime:0,banner:0,toast:0,shake:0,hitstop:0,ready:false,pausedFrom:'battle',high:innerWidth>720,moveTarget:null,moveTime:0};
let scene,camera,renderer,composer,sun,heroLight,hero,manifest,clock=0,previous=0,frameCount=0,frameTime=0,fps=0,intro=0;
let W=innerWidth,H=innerHeight,dpr=Math.min(devicePixelRatio,1.5),models=new Map(),actors=[],projectiles=[],particles=[],rings=[],arcs=[],numbers=[],torches=[],loadedBytes=0;
const usedModels=new Set(),environmentMeshes=[],cameraTarget=new V(),tmp=new V(),ndc=new THREE.Vector2(),ray=new THREE.Raycaster(),groundPlane=new THREE.Plane(new V(0,1,0),0);
const fx=$('effects'),ctx=fx.getContext('2d');
const styles={assault:{name:'猛攻の構え',damage:1.28,rate:.84,defense:1.15},balanced:{name:'均衡の構え',damage:1,rate:1,defense:1},guard:{name:'堅守の構え',damage:.87,rate:1.08,defense:.64}};

// Sound synthesis is not a model. Enable audio only after a user gesture.
class Sound {
 constructor(){this.on=false;this.audio=null;this.master=null;}
 toggle(){if(!this.audio){this.audio=new(window.AudioContext||window.webkitAudioContext)();this.master=this.audio.createGain();this.master.gain.value=.13;this.master.connect(this.audio.destination);}this.audio.resume();this.on=!this.on;$('sound').textContent=this.on?'音 ON':'音 OFF';if(this.on)this.note(164,.4,'sine',.16);}
 note(f,d,type='sine',volume=.3){if(!this.on)return;const t=this.audio.currentTime,o=this.audio.createOscillator(),g=this.audio.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.45),t+d);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d);}
 hit(big=false){this.note(big?110:240,big?.25:.11,'triangle',big?.8:.32);this.note(big?1800:2700,.055,'sawtooth',.10);}
}
const sound=new Sound();

function resize(){
 W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio,game.high?1.5:1);
 renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);
 const size=W/H<.8?31:23;camera.left=-size*W/H/2;camera.right=size*W/H/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();
 composer?.setPixelRatio(dpr);composer?.setSize(W,H);fx.width=Math.round(W*dpr);fx.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
function makeRenderer(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#0b2424');scene.fog=new THREE.FogExp2('#173432',.021);
 camera=new THREE.OrthographicCamera(-20,20,12,-12,.1,160);
 renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene.add(new THREE.HemisphereLight('#b2d3d0','#142b26',1.5));
 sun=new THREE.DirectionalLight('#f4dab0',2.8);sun.position.set(-10,20,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.normalBias=.045;sun.shadow.bias=-.0003;scene.add(sun);
 const rim=new THREE.DirectionalLight('#6da7cc',1.6);rim.position.set(8,9,-14);scene.add(rim);
 heroLight=new THREE.PointLight('#ffd99c',13,11,2);scene.add(heroLight);
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(W,H),.22,.5,1.15));composer.addPass(new OutputPass());resize();
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('描画環境が中断されました。再読み込みしてください。');});
 addEventListener('resize',resize);
}
async function loadAssets(){
 const response=await fetch(new URL('assets-manifest.json',NOCTURNE_ASSET_ORIGIN));if(!response.ok)throw Error('アセット一覧を取得できませんでした');manifest=await response.json();
 const keys=['adventurers/Knight','skeletons/Skeleton_Warrior','skeletons/Skeleton_Mage','skeletons/Skeleton_Minion',...['ground_grass','ground_pathTile','path_stoneCircle','path_stone','tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineRoundC','tree_detailed_dark','stone_largeB','stone_largeD','stone_tallB','stone_smallC','plant_bushDetailed','plant_bushSmall','grass_large','grass_leafsLarge','flower_purpleA','mushroom_redGroup','log_large','stump_roundDetailed','fence_planks','campfire_stones','statue_obelisk','statue_columnDamaged'].map(x=>'nature/'+x)];
 const loader=new GLTFLoader();let completed=0;
 async function one(key){
  const entry=manifest.models[key];if(!entry)throw Error('必須の外部モデルがありません: '+key);
  const gltf=await loader.loadAsync(new URL(entry.url,NOCTURNE_ASSET_ORIGIN).href);gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{if(o.isMesh){o.userData.assetSource=key;o.castShadow=true;o.receiveShadow=true;if(o.material.map)o.material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}});
  models.set(key,gltf);usedModels.add(key);loadedBytes+=entry.bytes;completed++;$('load-progress').style.width=(completed/keys.length*100)+'%';$('load-text').textContent=`森と旅人を読み込んでいます ${completed} / ${keys.length}`;
 }
 const queue=[...keys];await Promise.all(Array.from({length:4},async()=>{while(queue.length)await one(queue.shift());}));
}


// Only clone or instance geometry from downloaded models. No procedural solids.
function tintMaterial(material,key){
 const list=Array.isArray(material)?material:[material];
 const next=list.map(m=>{const n=m.clone();n.roughness=.9;n.metalness=0;if(/tree|plant|grass|flower/.test(key))n.color.multiply(new THREE.Color('#89ab9b'));else if(/stone|statue|path/.test(key))n.color.multiply(new THREE.Color('#799493'));else n.color.multiply(new THREE.Color('#8b9a83'));return n;});
 return Array.isArray(material)?next:next[0];
}
// Material-only shading of the original flat ground GLB. Vertex data is untouched.
function shadeFloor(material){
 for(const m of Array.isArray(material)?material:[material]){
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 vForestWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvForestWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
   shader.fragmentShader=`varying vec3 vForestWorld;
float fh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fh(i),fh(i+vec2(1,0)),f.x),mix(fh(i+vec2(0,1)),fh(i+vec2(1,1)),f.x),f.y);}
`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 fp=vForestWorld.xz;
float grain=fn(fp*1.7)*0.5+fn(fp*5.1)*0.3+fn(fp*19.0)*0.2;
float worn=1.0-smoothstep(4.8,9.3,length(fp)+fn(fp*0.65)*2.2);
worn=max(worn,(1.0-smoothstep(0.7,2.4,abs(fp.x+sin(fp.y*.5)*.35)))*smoothstep(0.0,3.0,fp.y));
vec3 earth=mix(vec3(.022,.048,.038),vec3(.071,.065,.052),worn);
diffuseColor.rgb=mix(diffuseColor.rgb*.48,earth,.8)*(.72+.5*grain);`);
  };
  m.customProgramCacheKey=()=> 'forest-ground-shading-v2';
 }
}
function prop(key,x,z,size=1,rotation=0,wide=false,y=0){
 key='nature/'+key;const root=models.get(key).scene.clone(true);const box=new THREE.Box3().setFromObject(root),dims=box.getSize(new V()),center=box.getCenter(new V());
 const s=size/(wide?Math.max(dims.x,dims.z):dims.y);const wrapper=new THREE.Group();root.position.set(-center.x,-box.min.y,-center.z);wrapper.add(root);wrapper.scale.setScalar(s);wrapper.rotation.y=rotation;wrapper.position.set(x,y,z);
 root.traverse(o=>{if(o.isMesh){o.material=tintMaterial(o.material,key);o.userData.assetSource=key;environmentMeshes.push(o);}});scene.add(wrapper);return wrapper;
}
function batch(key,placements){
 key='nature/'+key;const root=models.get(key).scene;root.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(root),dims=box.getSize(new V()),center=box.getCenter(new V()),normal=new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z);
 root.traverse(child=>{
  if(!child.isMesh)return;
  const inst=new THREE.InstancedMesh(child.geometry,tintMaterial(child.material,key),placements.length);inst.userData.assetSource=key;inst.castShadow=true;inst.receiveShadow=true;const object=new THREE.Object3D();
  placements.forEach((p,i)=>{object.position.set(p.x,p.y||0,p.z);object.rotation.set(0,p.r||0,0);object.scale.setScalar(p.h/dims.y);object.updateMatrix();inst.setMatrixAt(i,new THREE.Matrix4().copy(object.matrix).multiply(normal).multiply(child.matrixWorld));});
  inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();scene.add(inst);environmentMeshes.push(inst);
 });
}
function buildForest(){
 const original=models.get('nature/ground_grass').scene.clone(true),b=new THREE.Box3().setFromObject(original),s=b.getSize(new V()),c=b.getCenter(new V());const floor=new THREE.Group();
 original.position.set(-c.x,-b.max.y,-c.z);floor.add(original);floor.scale.set(75/s.x,.12/Math.max(.01,s.y),75/s.z);floor.position.y=-.06;
 original.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.material=tintMaterial(o.material,'ground_grass');shadeFloor(o.material);o.userData.assetSource='nature/ground_grass';}});scene.add(floor);
 for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){if(Math.hypot(x,z)>2.6)continue;const p=prop('ground_pathTile',x*3.45,z*3.45,3.5,Math.floor(rand()*4)*Math.PI/2,true,-.061);p.scale.y*=.12;p.traverse(o=>{if(o.isMesh)shadeFloor(o.material);});}
 const paving=prop('path_stoneCircle',0,-.4,6.7,0,true,-.055);paving.scale.y*=.12;
 const treeKinds=['tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineRoundC','tree_detailed_dark'];
 for(let k=0;k<treeKinds.length;k++){const placements=[];for(let i=0;i<29;i++){const a=rand()*TAU,r=randRange(13.6,30);placements.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h:randRange(5.8,9.7),r:rand()*TAU});}batch(treeKinds[k],placements);}
 for(const [key,count,lo,hi,h1,h2] of [['plant_bushDetailed',45,9.2,27,.9,2.1],['plant_bushSmall',34,8.5,24,.55,1.1],['grass_large',70,7,26,.25,.55],['grass_leafsLarge',40,9,26,.4,.75],['flower_purpleA',32,7.5,17,.25,.52],['mushroom_redGroup',18,8,18,.25,.5],['stone_smallC',40,5.2,23,.2,.6]]){
  const ps=[];for(let i=0;i<count;i++){const a=rand()*TAU,r=randRange(lo,hi);ps.push({x:Math.cos(a)*r,z:Math.sin(a)*r,h:randRange(h1,h2),r:rand()*TAU});}batch(key,ps);
 }
 for(let i=0;i<15;i++){const a=i/15*TAU+.2,r=randRange(10.2,13.3);prop(i%2?'stone_largeB':'stone_largeD',Math.cos(a)*r,Math.sin(a)*r,randRange(1.4,2.7),rand()*TAU);}
 for(let i=0;i<7;i++){const a=i/7*TAU+.3;prop('fence_planks',Math.cos(a)*10.2,Math.sin(a)*10.2,1.6,-a+Math.PI/2);}
 prop('statue_obelisk',-5,-8.4,4.4,.15);prop('statue_columnDamaged',5.5,-8,2.8,-.5);prop('stone_tallB',-8.4,2.3,3.5,.3);prop('log_large',9,4.2,3.8,.5,true);prop('log_large',-8,-5,3.3,1.3,true);prop('stump_roundDetailed',-7.9,6.2,1.3);
 for(const [x,z] of [[-7,-6],[7,-5],[-6.5,6.5],[6.8,7]]){prop('campfire_stones',x,z,1.35,rand()*TAU,true);const light=new THREE.PointLight('#ff9c43',33,11,2);light.position.set(x,.8,z);scene.add(light);torches.push({x,z,light,seed:rand()*9});}
 for(let i=0;i<7;i++){const p=prop('path_stone',Math.sin(i)*.4,8+i*1.8,1.9,rand()*.4,true,-.045);p.scale.y*=.25;}
}


function actor(kind,position,boss=false){
 const key=kind==='hero'?'adventurers/Knight':kind==='mage'?'skeletons/Skeleton_Mage':kind==='minion'?'skeletons/Skeleton_Minion':'skeletons/Skeleton_Warrior';
 const asset=models.get(key),root=cloneSkeleton(asset.scene),container=new THREE.Group();
 if(kind==='hero')for(const name of ['1H_Sword_Offhand','Rectangle_Shield','Round_Shield','Spike_Shield','2H_Sword']){const o=root.getObjectByName(name);if(o)o.visible=false;}
 if(kind!=='hero'&&kind!=='mage'){
  const sword=models.get('adventurers/Knight').scene.getObjectByName(boss?'2H_Sword':'1H_Sword');
  const socket=root.getObjectByName('handslotr')||root.getObjectByName('handslot.r');
  if(sword&&socket){const weapon=sword.clone(true);weapon.visible=true;weapon.traverse(o=>{if(o.isMesh)o.userData.assetSource='adventurers/Knight';});socket.add(weapon);}
 }
 const box=new THREE.Box3().setFromObject(root),height=kind==='hero'?2.95:boss?4.25:kind==='mage'?2.55:2.45;
 const scale=height/Math.max(.1,box.max.y-box.min.y);container.scale.setScalar(scale);container.add(root);container.position.copy(position);scene.add(container);
 const mats=[];
 root.traverse(o=>{if(o.isMesh){
  o.castShadow=true;o.receiveShadow=true;o.userData.assetSource=o.userData.assetSource||key;o.frustumCulled=false;
  const list=Array.isArray(o.material)?o.material:[o.material];
  const next=list.map(m=>{const n=m.clone();n.roughness=.74;n.metalness=.08;n.emissive=new THREE.Color('#000000');if(/Eyes/.test(o.name)){n.emissive.set(kind==='mage'?'#b870f1':'#c97450');n.emissiveIntensity=1.2;}mats.push({mat:n,base:n.emissive.clone(),power:n.emissiveIntensity});return n;});
  o.material=Array.isArray(o.material)?next:next[0];
 }});
 const a={kind,boss,root,object:container,pos:container.position,height,hp:kind==='hero'?220:boss?620:38+game.wave*8,maxHp:kind==='hero'?220:boss?620:38+game.wave*8,mixer:new THREE.AnimationMixer(root),clips:new Map(asset.animations.map(c=>[c.name,c])),action:null,actionName:'',attack:null,cd:randRange(.4,1.3),dead:false,deathTime:0,flash:0,showHp:0,mats,damage:kind==='hero'?27:boss?18:kind==='mage'?10:7,speed:kind==='hero'?2.7:boss?1.2:kind==='mage'?1.1:1.55,attackSpeed:1,combo:0,spawn:kind==='hero'?0:.7,trail:[]};
 actors.push(a);play(a,'Idle');if(kind!=='hero'){ring(a.pos,1.1,'#bf7dcb',.6);play(a,'Spawn_Ground_Skeletons',true,.8);}return a;
}
function play(a,name,once=false,duration=0){
 const clip=a.clips.get(name)||a.clips.get('Idle');if(!clip)return;if(a.actionName===name&&!once)return;
 const next=a.mixer.clipAction(clip);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(duration?clip.duration/duration:1);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
 if(a.action&&a.action!==next)a.action.fadeOut(.13);next.fadeIn(.12).play();a.action=next;a.actionName=name;
}
function removeActor(a){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);scene.remove(a.object);for(const {mat} of a.mats)mat.dispose();}
function face(a,target,dt){const yaw=Math.atan2(target.x-a.pos.x,target.z-a.pos.z);const delta=Math.atan2(Math.sin(yaw-a.object.rotation.y),Math.cos(yaw-a.object.rotation.y));a.object.rotation.y+=delta*Math.min(1,dt*12);}
function move(a,target,dt,mult=1){
 const d=new V().subVectors(target,a.pos);d.y=0;const distance=d.length();if(distance<.08)return false;face(a,target,dt);d.multiplyScalar(Math.min(distance,a.speed*dt*mult)/distance);a.pos.add(d);const r=Math.hypot(a.pos.x,a.pos.z);if(r>8.75)a.pos.multiplyScalar(8.75/r);play(a,a.kind==='hero'?'Running_A':'Walking_D_Skeletons');return true;
}


function startAttack(a,target){
 a.combo++;let duration=(a.kind==='hero'?.88:1.22)*(a.kind==='hero'?styles[game.stance].rate/a.attackSpeed:1);
 const heavy=a.kind==='hero'&&a.combo%3===0,big=a.boss&&a.combo%3===0;if(big)duration=1.6;
 const name=a.kind==='mage'?'Spellcast_Shoot':big?'2H_Melee_Attack_Chop':heavy?'1H_Melee_Attack_Slice_Horizontal':a.combo%2?'1H_Melee_Attack_Slice_Diagonal':'1H_Melee_Attack_Chop';
 a.attack={time:0,duration,target,hit:false,heavy,big};play(a,name,true,duration);a.trail=[];if(big)ring(a.pos,3.3,'#d45358',1.2,true);
}
function stepAttack(a,dt){
 const atk=a.attack;atk.time+=dt;if(!atk.target.dead)face(a,atk.target.pos,dt);
 if(atk.time>=atk.duration*.43&&!atk.hit){
  atk.hit=true;
  if(a.kind==='mage'){
   const direction=new V().subVectors(hero.pos,a.pos).normalize();projectiles.push({pos:a.pos.clone().add(new V(0,1.5,0)),vel:direction.multiplyScalar(6),life:2.3,damage:a.damage});sound.note(610,.17,'sine',.14);
  }else if(a.kind==='hero'){
   const reach=atk.heavy?3.25:2.35;arc(a.pos,reach,a.object.rotation.y,atk.heavy?2.8:1.9,'#f7cf80',.32);let hits=0;
   for(const enemy of actors){
    if(enemy.kind==='hero'||enemy.dead)continue;
    const dist=enemy.pos.distanceTo(a.pos);const delta=Math.atan2(enemy.pos.x-a.pos.x,enemy.pos.z-a.pos.z)-a.object.rotation.y;
    if(dist<reach&&Math.cos(delta)>-.25){const crit=rand()<.16;damage(enemy,Math.round(a.damage*styles[game.stance].damage*(atk.heavy?1.3:1)*(crit?1.7:1)),a,crit);hits++;}
   }
   if(hits){sound.hit(atk.heavy);game.hitstop=atk.heavy?.055:.032;game.shake=atk.heavy?.12:.045;game.energy=clamp(game.energy+6,0,100);}
  }else if(atk.big){
   ring(a.pos,3.4,'#e47b5c',.5);burst(a.pos,30,'#da9365');if(hero.pos.distanceTo(a.pos)<3.5)damage(hero,a.damage*1.7,a);game.shake=.18;sound.hit(true);
  }else if(!hero.dead&&hero.pos.distanceTo(a.pos)<2.35){damage(hero,a.damage,a);arc(a.pos,1.9,a.object.rotation.y,1.5,'#c98a83',.2);sound.hit();}
 }
 if(atk.time>=atk.duration){a.attack=null;a.cd=a.kind==='hero'?.10:a.kind==='mage'?1.4:a.boss?.55:randRange(.65,1.2);play(a,'Idle');}
}
function damage(target,amount,source,critical=false){
 if(target.dead)return;
 if(target.kind==='hero')amount=Math.max(1,Math.round(amount*styles[game.stance].defense));
 target.hp=Math.max(0,target.hp-amount);target.flash=.15;target.showHp=3;
 const away=new V().subVectors(target.pos,source.pos).setY(0).normalize();if(target.kind!=='hero')target.pos.addScaledVector(away,.16);
 const color=target.kind==='hero'?'#dc8c80':critical?'#fff1b8':'#dfd7bd';
 numbers.push({pos:target.pos.clone().add(new V(0,target.height*.8,0)),text:String(amount),color,life:1.05,max:1.05,critical,drift:randRange(-15,15)});
 burst(target.pos.clone().add(new V(0,1.1,0)),critical?16:7,target.kind==='hero'?'#c98171':'#e8bf75');
 if(target.kind==='hero')game.received+=amount;else game.damage+=amount;
 if(target.hp<=0){
  target.dead=true;target.attack=null;target.deathTime=0;play(target,target.kind==='hero'?'Death_A':'Death_C_Skeletons',true,1.3);
  if(target.kind==='hero'){record('defeat');game.phase='defeat-delay';game.endingDelay=1.6;}
  else{
   game.kills++;game.energy=clamp(game.energy+9,0,100);hero.hp=Math.min(hero.maxHp,hero.hp+2.5);record('kill',{kind:target.kind,boss:target.boss,kills:game.kills});
   for(let i=0;i<5;i++)particles.push({pos:target.pos.clone().add(new V(0,.8,0)),vel:new V(randRange(-1,1),randRange(1,2),randRange(-1,1)),life:1.4,max:1.4,color:'#c2e0be',size:2,soul:true});
  }
 }
}
function ring(pos,radius,color,life=1,warn=false){rings.push({pos:pos.clone(),radius,color,life,max:life,warn});}
function arc(pos,radius,angle,sweep,color,life){arcs.push({pos:pos.clone(),radius,angle,sweep,color,life,max:life});}
function burst(pos,count,color){
 for(let i=0;i<count;i++){const angle=rand()*TAU,s=randRange(1,5);particles.push({pos:pos.clone(),vel:new V(Math.cos(angle)*s,randRange(1,4),Math.sin(angle)*s),life:randRange(.25,.7),max:.7,color,size:randRange(1,3)});}
 if(particles.length>260)particles.splice(0,particles.length-260);
}
function castBurst(){
 game.energy=0;game.bursts++;game.shake=.2;game.hitstop=.075;ring(hero.pos,5,'#ffdb86',.85);ring(hero.pos,3.8,'#fff3c4',.55);burst(hero.pos.clone().add(new V(0,1,0)),42,'#ffe2a5');arc(hero.pos,4.5,0,TAU,'#f8da8e',.7);
 for(const a of actors)if(a.kind!=='hero'&&!a.dead&&a.pos.distanceTo(hero.pos)<5)damage(a,Math.round(hero.damage*2.4),hero,true);
 hero.hp=Math.min(hero.maxHp,hero.hp+18);toast('暁の一閃');sound.note(85,.8,'triangle',.8);record('burst');
}


function spawnEnemy(){
 const a=rand()*TAU,r=randRange(6.8,8.5),kind=game.wave>1&&game.spawned%4===3?'mage':game.spawned%3===0?'warrior':'minion';
 const boss=game.wave===5&&game.spawned===game.waveCount-1;
 const unit=actor(boss?'warrior':kind,new V(Math.cos(a)*r,0,Math.sin(a)*r),boss);
 if(boss){show('boss-hud');game.boss=unit;banner('灰の王','THE LAST OATH');record('boss-spawn');}
 game.spawned++;record('spawn',{kind:unit.kind,boss});
}
function wave(){
 game.wave++;game.waveCount=[0,6,8,10,12,10][game.wave];game.spawned=0;game.spawnTimer=.8;game.phase='battle';game.banner=3.5;
 banner(`襲撃 ${String(game.wave).padStart(2,'0')}`,game.wave===5?'THE FINAL INCURSION':'THE WOODS ARE WATCHING');
 $('wave-label').textContent=`襲撃 ${String(game.wave).padStart(2,'0')}`;
 [...$('wave-pips').children].forEach((e,i)=>e.classList.toggle('active',i<game.wave));record('wave',{wave:game.wave});
}
function banner(text,sub){$('wave-banner').querySelector('span').textContent=text;$('wave-banner').querySelector('small').textContent=sub;$('wave-banner').classList.add('show');game.banner=3;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');game.toast=2.2;}
function start(){
 for(const a of actors)removeActor(a);actors=[];particles=[];projectiles=[];arcs=[];rings=[];numbers=[];
 Object.assign(game,{phase:'battle',time:0,wave:0,kills:0,damage:0,received:0,bursts:0,energy:0,level:1,moveTarget:null,boss:null,shake:0,hitstop:0});
 $('level-label').textContent='LV. 1';hero=actor('hero',new V(0,0,2.5));hero.object.rotation.y=Math.PI;
 for(const id of ['title','ending','paused','upgrade','boss-hud'])show(id,false);show('hud');$('move-hint').style.opacity='1';cameraTarget.copy(hero.pos).multiplyScalar(.15);wave();record('start');
}
function title(){
 for(const a of actors)removeActor(a);actors=[];particles=[];projectiles=[];arcs=[];rings=[];numbers=[];
 hero=actor('hero',new V(1,0,1));hero.object.rotation.y=-.5;
 for(const id of ['hud','ending','paused','upgrade','boss-hud'])show(id,false);show('title');game.phase='title';intro=0;
 const dummy=actor('warrior',new V(-4,0,-4));dummy.object.rotation.y=.7;dummy.spawn=0;play(dummy,'Idle');
 const dummy2=actor('mage',new V(4,0,-5.5));dummy2.object.rotation.y=-.5;dummy2.spawn=0;play(dummy2,'Idle');
}
function chooseUpgrade(choice){
 if(game.phase!=='upgrade')return;
 if(choice==='power')hero.damage*=1.22;
 else if(choice==='vitality'){hero.maxHp+=40;hero.hp=Math.min(hero.maxHp,hero.hp+85);}
 else hero.attackSpeed*=1.15;
 hero.hp=Math.min(hero.maxHp,hero.hp+25);game.level++;$('level-label').textContent='LV. '+game.level;show('upgrade',false);record('upgrade',{choice});wave();
}
function ending(win){
 game.phase=win?'victory':'defeat';for(const id of ['upgrade','boss-hud','paused'])show(id,false);show('ending',false);setTimeout(()=>{if(game.ready)start();},1000);
 $('end-eyebrow').textContent=win?'THE FIRST LIGHT':'AN UNFINISHED OATH';$('end-title').textContent=win?'夜明けに、剣を置く。':'誓いは、まだ消えない。';$('end-copy').textContent=win?'灰の森に、静けさが戻った。':'構えと強化を変えて、もう一度。';
 $('end-stats').innerHTML=`<div><b>${game.kills}</b><span>討伐数</span></div><div><b>${formatTime(game.time)}</b><span>生存時間</span></div><div><b>${game.bursts}</b><span>暁の一閃</span></div>`;
 if(win){play(hero,'Cheer');record('victory');}
}
function pause(){
 if(game.phase==='paused'){game.phase=game.pausedFrom;show('paused',false);}
 else if(game.phase==='battle'||game.phase==='upgrade'){game.pausedFrom=game.phase;game.phase='paused';show('paused');}
}
function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}


function simulate(dt){
 const battle=game.phase==='battle';
 if(battle){
  game.time+=dt;game.spawnTimer-=dt;
  const alive=actors.filter(a=>a.kind!=='hero'&&!a.dead);
  if(game.spawned<game.waveCount&&game.spawnTimer<=0&&alive.length<7){spawnEnemy();game.spawnTimer=game.spawned<3?.5:1.8;}
  if(game.spawned===game.waveCount&&!actors.some(a=>a.kind!=='hero'&&!a.dead)){
   if(game.wave===5)ending(true);
   else{game.phase='upgrade';game.upgradeTime=6;show('upgrade');play(hero,'Idle');record('wave-clear',{wave:game.wave});}
  }
  if(game.energy>=100&&!hero.dead)castBurst();
  if(game.stance==='guard')hero.hp=Math.min(hero.maxHp,hero.hp+dt*.9);game.moveTime-=dt;
 }
 if(game.phase==='upgrade'){
  game.upgradeTime-=dt;$('upgrade-countdown').textContent=`${Math.max(0,Math.ceil(game.upgradeTime))}秒後に自動選択`;
  if(game.upgradeTime<=0)chooseUpgrade(hero.hp/hero.maxHp<.6?'vitality':'power');
 }
 if(game.phase==='defeat-delay'){game.endingDelay-=dt;if(game.endingDelay<=0)ending(false);}
 for(const a of actors){
  a.mixer.update(dt);
  if(a.dead){a.deathTime+=dt;if(a.deathTime>1.5&&a.kind!=='hero')a.pos.y-=dt*.65;continue;}
  a.flash=Math.max(0,a.flash-dt);a.showHp=Math.max(0,a.showHp-dt);
  for(const {mat,base,power} of a.mats){mat.emissive.copy(a.flash>0?new THREE.Color('#ffe7c4'):base);mat.emissiveIntensity=a.flash>0?1.7:power;}
  if(!battle)continue;
  if(a.spawn>0){a.spawn-=dt;continue;}
  if(a.attack){stepAttack(a,dt);continue;}a.cd-=dt;
  if(a.kind==='hero'){
   const target=actors.filter(e=>e.kind!=='hero'&&!e.dead&&e.spawn<=0).sort((a,b)=>a.pos.distanceToSquared(hero.pos)-b.pos.distanceToSquared(hero.pos))[0];
   if(game.moveTarget&&game.moveTime>0&&hero.pos.distanceTo(game.moveTarget)>.25){move(a,game.moveTarget,dt);continue;}
   if(target){const dist=a.pos.distanceTo(target.pos);face(a,target.pos,dt);if(dist>1.85)move(a,target.pos,dt);else if(a.cd<=0)startAttack(a,target);else play(a,'Idle');}else play(a,'Idle');
  }else if(!hero.dead){
   const dist=a.pos.distanceTo(hero.pos),range=a.kind==='mage'?5.8:a.boss?2.2:1.72;face(a,hero.pos,dt);
   if(dist>range)move(a,hero.pos,dt);
   else if(a.kind==='mage'&&dist<3){const back=a.pos.clone().add(new V().subVectors(a.pos,hero.pos).normalize().multiplyScalar(2));move(a,back,dt,.6);if(a.cd<=0)startAttack(a,hero);}
   else if(a.cd<=0)startAttack(a,hero);else play(a,'Idle');
  }
 }
 // Mathematical collision circles, not generated 3D proxy meshes.
 if(battle){
  const live=actors.filter(a=>!a.dead);
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
   const a=live[i],b=live[j],dx=a.pos.x-b.pos.x,dz=a.pos.z-b.pos.z,dist=Math.hypot(dx,dz),gap=a.boss||b.boss?1.25:1.05;
   if(dist<gap&&dist>.001){const push=(gap-dist)*.5,factor=a.kind==='hero'?.3:1;a.pos.x+=dx/dist*push*factor;a.pos.z+=dz/dist*push*factor;b.pos.x-=dx/dist*push;b.pos.z-=dz/dist*push;}
  }
 }
 for(const p of projectiles){p.life-=dt;p.pos.addScaledVector(p.vel,dt);if(!hero.dead&&Math.hypot(p.pos.x-hero.pos.x,p.pos.z-hero.pos.z)<.85){damage(hero,p.damage,{pos:p.pos});p.life=-1;}}
 projectiles=projectiles.filter(p=>p.life>0);
 for(const p of particles){p.life-=dt;if(p.soul&&p.life<.9)p.vel.lerp(new V().subVectors(hero.pos.clone().add(new V(0,1,0)),p.pos).multiplyScalar(5),dt*9);else p.vel.y-=dt*6;p.pos.addScaledVector(p.vel,dt);}
 particles=particles.filter(p=>p.life>0);
 for(const n of numbers)n.life-=dt;numbers=numbers.filter(n=>n.life>0);
 for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);
 for(const a of arcs)a.life-=dt;arcs=arcs.filter(a=>a.life>0);
 for(const a of [...actors])if(a.dead&&a.kind!=='hero'&&a.deathTime>3){removeActor(a);actors.splice(actors.indexOf(a),1);}
 game.banner=Math.max(0,game.banner-dt);if(game.banner<=0)$('wave-banner').classList.remove('show');
 game.toast=Math.max(0,game.toast-dt);if(!game.toast)$('toast').classList.remove('show');
 game.shake=Math.max(0,game.shake-dt*.9);if(game.time>10)$('move-hint').style.opacity='0';
}


function project(pos){const v=pos.clone().project(camera);return{x:(v.x*.5+.5)*W,y:(-.5*v.y+.5)*H,z:v.z};}
function groundPath(pos,radius,begin=0,end=TAU){
 ctx.beginPath();const steps=Math.ceil((end-begin)*12);
 for(let i=0;i<=steps;i++){const a=begin+(end-begin)*i/steps,p=project(new V(pos.x+Math.sin(a)*radius,pos.y+.045,pos.z+Math.cos(a)*radius));i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
 if(end-begin>=TAU-.01)ctx.closePath();
}
function glow(x,y,r,color,alpha=1){
 if(r<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.globalAlpha=1;
}
function drawEffects(){
 ctx.clearRect(0,0,W,H);const scale=H/(camera.top-camera.bottom);
 // Every effect here is drawn on a 2D canvas, never as modeled geometry.
 for(const t of torches){
  const p=project(new V(t.x,.6,t.z)),flicker=1+Math.sin(clock*7+t.seed)*.12;
  ctx.globalCompositeOperation='screen';glow(p.x,p.y,scale*2.3,'#ea731a',.22*flicker);glow(p.x,p.y,scale*.42,'#ffd38a',.85);ctx.globalCompositeOperation='source-over';
  for(let i=0;i<4;i++){const phase=(clock*.6+i*.25+t.seed)%1,q=project(new V(t.x+Math.sin(clock*2+i)*.11,.3+phase*1.5,t.z));ctx.fillStyle='#ffd08e';ctx.globalAlpha=(1-phase)*.75;ctx.beginPath();ctx.ellipse(q.x,q.y,scale*.045,scale*.13*(1-phase),Math.sin(clock+i)*.3,0,TAU);ctx.fill();}ctx.globalAlpha=1;
 }
 for(let i=0;i<34;i++){
  const x=Math.sin(i*124.7)*18+Math.sin(clock*.07+i)*2,z=Math.cos(i*48.3)*18,y=1+(Math.sin(clock*.16+i)*.5+.5)*3.5,p=project(new V(x,y,z));
  ctx.fillStyle=i%3?'#c7d4b9':'#e6d19a';ctx.globalAlpha=(.18+.16*Math.sin(clock+i))*(i%3?.55:1);ctx.beginPath();ctx.arc(p.x,p.y,i%3?.75:1.3,0,TAU);ctx.fill();
 }ctx.globalAlpha=1;
 if(hero&&!hero.dead){groundPath(hero.pos,.85);ctx.strokeStyle='#e9d59c';ctx.lineWidth=1;ctx.globalAlpha=.45;ctx.stroke();ctx.globalAlpha=1;}
 for(const r of rings){
  const f=1-r.life/r.max;groundPath(r.pos,r.radius*(r.warn?1:.2+.8*f));ctx.strokeStyle=r.color;ctx.lineWidth=r.warn?1.5:3*(1-f)+1;ctx.globalAlpha=r.warn?.2+f*.55:(1-f)*.8;ctx.stroke();
  if(r.warn){ctx.fillStyle=r.color;ctx.globalAlpha=.04+f*.09;ctx.fill();}ctx.globalAlpha=1;
 }
 ctx.globalCompositeOperation='screen';
 for(const a of arcs){
  const f=1-a.life/a.max,start=a.angle-a.sweep*.6+f*.8;groundPath(a.pos,a.radius*(.88+f*.17),start,start+a.sweep);ctx.strokeStyle=a.color;ctx.lineWidth=Math.max(1,scale*.15*(1-f));ctx.globalAlpha=(1-f)*.86;ctx.shadowColor=a.color;ctx.shadowBlur=14;ctx.stroke();groundPath(a.pos,a.radius*.85,start+.3,start+a.sweep);ctx.lineWidth=Math.max(1,scale*.045);ctx.globalAlpha=(1-f)*.75;ctx.stroke();
 }ctx.shadowBlur=0;ctx.globalAlpha=1;
 for(const p of projectiles){
  const pt=project(p.pos);glow(pt.x,pt.y,20,'#b271ee',.75);ctx.fillStyle='#e4bcff';ctx.beginPath();ctx.arc(pt.x,pt.y,3.5,0,TAU);ctx.fill();const tail=project(p.pos.clone().addScaledVector(p.vel,-.16));ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(pt.x,pt.y);ctx.strokeStyle='#b871eb';ctx.lineWidth=2;ctx.stroke();
 }
 for(const p of particles){const pt=project(p.pos);ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(pt.x,pt.y,p.size,0,TAU);ctx.fill();}
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 if(game.phase!=='title')for(const a of actors){
  if(a.dead||a.kind==='hero'||a.boss||a.spawn>0)continue;const p=project(a.pos.clone().add(new V(0,a.height+.28,0))),width=Math.max(24,scale*.95);
  ctx.fillStyle='#081b17b0';ctx.fillRect(p.x-width/2-1,p.y-1,width+2,5);ctx.fillStyle=a.kind==='mage'?'#b88aa4':'#b87169';ctx.fillRect(p.x-width/2,p.y,width*a.hp/a.maxHp,3);
 }
 for(const n of numbers){
  const p=project(n.pos),f=1-n.life/n.max;ctx.globalAlpha=Math.min(1,n.life*2.8);ctx.font=`${n.critical?'bold ':''}${n.critical?21:15}px Georgia`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#10241bcc';ctx.strokeText(n.text,p.x+n.drift*f,p.y-f*43);ctx.fillStyle=n.color;ctx.fillText(n.text,p.x+n.drift*f,p.y-f*43);
 }ctx.globalAlpha=1;
 const mist=ctx.createLinearGradient(0,H*.18,0,H*.9);mist.addColorStop(0,'#739d970b');mist.addColorStop(.5,'transparent');mist.addColorStop(1,'#2c726807');ctx.fillStyle=mist;ctx.fillRect(0,0,W,H);
}


function updateUI(){
 if(!hero)return;const hp=clamp(hero.hp/hero.maxHp,0,1);$('health-fill').style.width=(hp*100)+'%';$('hp-label').textContent=`${Math.ceil(hero.hp)} / ${Math.round(hero.maxHp)}`;$('kills').textContent=game.kills;$('timer').textContent=formatTime(game.time);$('burst-icon').style.setProperty('--energy',game.energy+'%');$('burst-text').textContent=`${Math.floor(game.energy)}% · 自動発動`;if(game.boss)$('boss-fill').style.width=(game.boss.hp/game.boss.maxHp*100)+'%';
}
function renderCamera(dt){
 if(!hero)return;intro+=dt;const isTitle=game.phase==='title';
 const follow=W/H<.8?.9:.4;
 const desired=isTitle?new V(-2,.6,0):hero.pos.clone().multiplyScalar(follow).add(new V(0,.65,-.4));cameraTarget.lerp(desired,1-Math.exp(-dt*3.4));
 const baseAngle=isTitle?.62+Math.sin(intro*.045)*.08:.65,approach=isTitle?1+Math.max(0,1-intro/7)*.32:1;
 camera.position.set(cameraTarget.x+Math.sin(baseAngle)*23*approach,cameraTarget.y+22*approach,cameraTarget.z+Math.cos(baseAngle)*23*approach);
 if(game.shake>0){camera.position.x+=Math.sin(clock*93)*game.shake;camera.position.y+=Math.cos(clock*84)*game.shake*.6;}
 camera.lookAt(cameraTarget);camera.updateMatrixWorld();heroLight.position.copy(hero.pos).add(new V(0,3.5,0));for(const t of torches)t.light.intensity=30+Math.sin(clock*7+t.seed)*5;
}
function loop(now){
 try{
  const elapsed=(now-previous)/1000||1/60,realDt=Math.min(.05,elapsed);previous=now;clock+=realDt;
  const frozen=game.phase==='paused'||document.hidden;let dt=frozen?0:realDt*(game.phase==='title'?1:game.speed);
  if(game.hitstop>0){game.hitstop-=realDt;dt*=.12;}
  if(game.ready&&dt>0)simulate(dt);renderCamera(realDt);
  renderer.info.autoReset=false;renderer.info.reset();if(game.high)composer.render();else renderer.render(scene,camera);drawEffects();
  frameCount++;frameTime+=elapsed;if(frameTime>.5){fps=Math.round(frameCount/frameTime);frameTime=0;frameCount=0;updateUI();}
 }catch(error){console.error(error);fail(error.message);renderer.setAnimationLoop(null);}
}
function fail(message){$('fatal-detail').textContent=message;show('fatal');show('loader',false);record('error',{message});}
$('start').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('resume').onclick=pause;$('back-title').onclick=title;$('end-title-button').onclick=title;
$('sound').onclick=()=>sound.toggle();$('credits-open').onclick=()=>$('credits').showModal();$('credits-close').onclick=()=>$('credits').close();
$('speed').onclick=()=>{game.speed=game.speed===1?2:1;$('speed').textContent=game.speed+'×';};
$('quality').onclick=()=>{game.high=!game.high;$('quality').textContent=game.high?'画質 高':'画質 標準';resize();};
for(const btn of document.querySelectorAll('[data-stance]'))btn.onclick=()=>{game.stance=btn.dataset.stance;document.querySelectorAll('[data-stance]').forEach(x=>x.classList.toggle('selected',x===btn));$('stance-label').textContent=styles[game.stance].name;toast(styles[game.stance].name);record('stance',{stance:game.stance});};
for(const btn of document.querySelectorAll('[data-upgrade]'))btn.onclick=()=>chooseUpgrade(btn.dataset.upgrade);
$('world').addEventListener('pointerdown',e=>{
 if(game.phase!=='battle')return;ndc.set(e.clientX/W*2-1,-e.clientY/H*2+1);ray.setFromCamera(ndc,camera);const pos=new V();
 if(ray.ray.intersectPlane(groundPlane,pos)){pos.y=0;const len=pos.length();if(len>8.5)pos.multiplyScalar(8.5/len);game.moveTarget=pos;game.moveTime=3;ring(pos,.55,'#d4c993',.8);record('waypoint',{x:pos.x,z:pos.z});}
});
addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Escape'){if($('credits').open)return;e.preventDefault();pause();}});
window.__NOCTURNE__={
 game,trace,
 get metrics(){
  let meshes=0,skinned=0,unattributed=0;scene?.traverse(o=>{if(o.isMesh){meshes++;if(o.isSkinnedMesh)skinned++;if(!o.userData.assetSource)unattributed++;}});
  return{ready:game.ready,phase:game.phase,wave:game.wave,kills:game.kills,damage:game.damage,received:game.received,bursts:game.bursts,time:game.time,hp:hero?.hp,maxHp:hero?.maxHp,models:[...usedModels],loadedBytes,meshes,skinned,unattributed,generatedModels:0,actors:actors.length,activeAnimations:actors.filter(a=>a.action?.isRunning()).length,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,fps,webgl2:!!renderer?.getContext().texStorage2D};
 },
 inspectActors:()=>actors.map(a=>({kind:a.kind,hp:a.hp,pos:a.pos.toArray(),animation:a.actionName,attack:a.attack?.time,nodes:a.root.children.map(o=>o.name)})),
 advance(seconds){for(let i=0;i<seconds*60;i++){if(['paused','title','victory','defeat'].includes(game.phase))break;simulate(1/60);}updateUI();},start,title
};
try{
 makeRenderer();await loadAssets();buildForest();game.ready=true;start();$('quality').textContent=game.high?'画質 高':'画質 標準';
 await renderer.compileAsync(scene,camera);show('loader',false);previous=performance.now();renderer.setAnimationLoop(loop);record('ready',{models:usedModels.size});
}catch(error){console.error(error);fail(error.message);}

