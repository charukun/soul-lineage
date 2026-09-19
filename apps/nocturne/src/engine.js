import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
 const response=await fetch('assets-manifest.json');if(!response.ok)throw Error('アセット一覧を取得できませんでした');manifest=await response.json();
 const keys=['adventurers/Knight','skeletons/Skeleton_Warrior','skeletons/Skeleton_Mage','skeletons/Skeleton_Minion',...['ground_grass','ground_pathTile','path_stoneCircle','path_stone','tree_pineTallA_detailed','tree_pineTallB_detailed','tree_pineRoundC','tree_detailed_dark','stone_largeB','stone_largeD','stone_tallB','stone_smallC','plant_bushDetailed','plant_bushSmall','grass_large','grass_leafsLarge','flower_purpleA','mushroom_redGroup','log_large','stump_roundDetailed','fence_planks','campfire_stones','statue_obelisk','statue_columnDamaged'].map(x=>'nature/'+x)];
 const loader=new GLTFLoader();let completed=0;
 async function one(key){
  const entry=manifest.models[key];if(!entry)throw Error('必須の外部モデルがありません: '+key);
  const gltf=await loader.loadAsync(entry.url);gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{if(o.isMesh){o.userData.assetSource=key;o.castShadow=true;o.receiveShadow=true;if(o.material.map)o.material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}});
  models.set(key,gltf);usedModels.add(key);loadedBytes+=entry.bytes;completed++;$('load-progress').style.width=(completed/keys.length*100)+'%';$('load-text').textContent=`森と旅人を読み込んでいます ${completed} / ${keys.length}`;
 }
 const queue=[...keys];await Promise.all(Array.from({length:4},async()=>{while(queue.length)await one(queue.shift());}));
}
