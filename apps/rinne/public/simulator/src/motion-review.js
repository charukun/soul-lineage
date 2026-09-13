import * as T from '../vendor/three.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {HumanoidRuntime} from './humanoid.js';
import {SLASH_TIMING,SLASH_SECONDS,SLASH_REVISION} from './authored-slash.js';
import {createReviewSword} from './review-sword.js';
const $=id=>document.getElementById(id),canvas=$('motion-stage');
let renderer,runtime,controls,frame=0,playing=true,last=0,elapsed=0;
const scene=new T.Scene();scene.background=new T.Color('#25343c');scene.fog=new T.Fog('#25343c',8,16);
const camera=new T.PerspectiveCamera(35,1,.05,30);
const actor={id:'motion-review-shino',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,vx:0,vz:0,combatReady:true,_humanoidClock:0,attack:{id:'slash-preview',kind:'slash',t:0,duration:SLASH_SECONDS}};
const status=message=>{$('motion-status').textContent=message;};
const api={weapons:{sword:{base:.21,tip:1.62,width:.065}},strikes:{slash:{}},clips:{slash:SLASH_TIMING},windows:{},
  progress:(a,t)=>Math.min(1,Math.max(0,(t??a.attack.t)/SLASH_SECONDS)),window:(_kind,p)=>p>=SLASH_TIMING.active[0]&&p<=SLASH_TIMING.active[1]?0:-1,
  attach:c=>scene.add(c.root),status};
const sword=createReviewSword();sword.matrixAutoUpdate=false;scene.add(sword);
function phaseLabel(p){return p<.12?'構え':p<.34?'溜め':p<.46?'踏み込み':p<.60?'斬撃':p<.82?'振り抜き':'構えへ';}
function render(){
  if(!runtime?.ready||!renderer)return;
  actor.attack.t=elapsed*SLASH_SECONDS;
  const result=runtime.render(actor);sword.matrix.fromArray(result.sm);sword.matrixWorldNeedsUpdate=true;
  controls.update();renderer.render(scene,camera);
  $('timeline').value=String(elapsed);$('phase-label').textContent=phaseLabel(elapsed);
}
function resetContacts(){if(runtime?.current){const c=runtime.current;c.state=null;c.lastActual=null;c.blending=null;c.footLocks={};c.resetSpring=true;}}
function seek(p){playing=false;elapsed=Math.min(1,Math.max(0,p));resetContacts();syncPlay();render();}
function syncPlay(){$('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-pressed',String(playing));}
function fittedDistance(){return Math.max(4.9,1.5/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect)+.65);}
function view(id){const target=new T.Vector3(0,1.13,.3),distance=fittedDistance();const angles={three:.72,front:0,side:Math.PI/2,back:Math.PI};const yaw=angles[id]??.72;camera.position.set(Math.sin(yaw)*distance,1.13+distance*.16,.3+Math.cos(yaw)*distance);controls.target.copy(target);controls.update();for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===id));render();}
function resize(){if(!renderer)return;const box=canvas.parentElement.getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/Math.max(1,box.height);camera.updateProjectionMatrix();if(controls){const offset=camera.position.clone().sub(controls.target).normalize();camera.position.copy(controls.target).addScaledVector(offset,fittedDistance());controls.update();}render();}
function loop(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  if(!document.hidden&&playing&&runtime?.ready){const speed=Number($('speed').value);actor._humanoidClock+=dt*speed;elapsed+=dt*speed/SLASH_SECONDS;if(elapsed>1.48){elapsed=0;resetContacts();}const hold=elapsed;elapsed=Math.min(1,elapsed);render();elapsed=hold;}
  frame=requestAnimationFrame(loop);
}
async function start(){try{
  renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  scene.add(new T.HemisphereLight('#d8eafa','#676552',2.0));const light=new T.DirectionalLight('#fff0d3',2.7);light.position.set(-3,5,4);scene.add(light);const rim=new T.DirectionalLight('#a8cae7',1.0);rim.position.set(3,2,-3);scene.add(rim);
  const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#263a40',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.02;scene.add(floor);
  const grid=new T.GridHelper(12,24,'#637779','#364f55');grid.position.y=.022;scene.add(grid);
  const shadow=new T.Mesh(new T.CircleGeometry(.48,48),new T.MeshBasicMaterial({color:'#0c1a20',transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.65;shadow.position.set(0,.025,0);scene.add(shadow);
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=2.5;controls.maxDistance=16;controls.maxPolarAngle=Math.PI*.49;controls.enablePan=false;controls.addEventListener('change',()=>{if(!playing&&runtime?.ready)renderer.render(scene,camera);});
  runtime=new HumanoidRuntime(api);await runtime.load('SHINO');
  for(const id of ['play','restart','previous-frame','next-frame','timeline'])$(id).disabled=false;
  $('motion-version').textContent=`斬撃 ${SLASH_REVISION} · 1動作 ${SLASH_SECONDS.toFixed(2)}秒`;
  status('しのちゃんの斬撃 · エフェクトなし');view('three');resize();syncPlay();frame=requestAnimationFrame(loop);
}catch(e){status(`表示できませんでした：${e.message}`);$('retry').hidden=false;}}
$('play').onclick=()=>{playing=!playing;if(playing&&elapsed>=1){elapsed=0;resetContacts();}last=0;syncPlay();};
$('restart').onclick=()=>{elapsed=0;resetContacts();playing=true;last=0;syncPlay();render();};
$('timeline').oninput=e=>seek(Number(e.target.value));
$('previous-frame').onclick=()=>seek(Math.min(1,elapsed)-1/(60*SLASH_SECONDS));
$('next-frame').onclick=()=>seek(Math.min(1,elapsed)+1/(60*SLASH_SECONDS));
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{if(controls)view(b.dataset.view);};
$('retry').onclick=()=>location.reload();window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{last=0;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;syncPlay();status('描画が中断しました。再読み込みしてください。');$('retry').hidden=false;});
window.addEventListener('pageshow',e=>{if(e.persisted){last=0;frame=requestAnimationFrame(loop);resize();}});
window.addEventListener('pagehide',e=>{cancelAnimationFrame(frame);if(e.persisted)return;controls?.dispose();if(runtime?.current)runtime.dispose(runtime.current);scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});renderer?.dispose();});
start();
