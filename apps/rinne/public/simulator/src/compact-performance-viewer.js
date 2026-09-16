import * as T from '../vendor/three.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {CompactPerformanceRuntime,COMPACT_PERFORMANCE_MODEL,COMPACT_PERFORMANCE_REVISION} from './compact-performance.js';
import {PERFORMANCE_SECONDS,PERFORMANCE_REVISION,samplePerformance} from './sword-performance.js';
import {createReviewWeapon,REVIEW_WEAPONS} from './review-sword.js';

const $=id=>document.getElementById(id);
const canvas=$('performance-stage');
const status=$('performance-status');
const phase=$('performance-phase');
const timeLabel=$('performance-time');
const play=$('performance-play');
const restart=$('performance-restart');
const timeline=$('performance-timeline');
const speed=$('performance-speed');
const retry=$('performance-retry');

let renderer,controls,runtime,weapon,shadow,frame=0,last=0,elapsed=0,playing=true;
const scene=new T.Scene();
scene.background=new T.Color('#111820');
scene.fog=new T.Fog('#111820',8,18);
const camera=new T.PerspectiveCamera(35,1,.05,32);
const focus=new T.Vector3(0,1.05,.25);

function setStatus(text,error=false){status.textContent=text;status.dataset.kind=error?'error':'';}
function syncPlay(){play.textContent=playing?'一時停止':'再生';play.setAttribute('aria-pressed',String(playing));}
function setView(id='three'){
  const distance=6.2,yaw=({three:.72,front:0,side:Math.PI/2,back:Math.PI})[id]??.72;
  focus.copy(runtime?.focus(false)||new T.Vector3(0,1.05,.25));
  camera.position.set(focus.x+Math.sin(yaw)*distance,focus.y+1.05,focus.z+Math.cos(yaw)*distance);
  controls?.target.copy(focus);controls?.update();
  for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===id));
  render();
}
function resize(){
  if(!renderer)return;
  const box=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,box.width),Math.max(1,box.height),false);
  camera.aspect=Math.max(.1,box.width/Math.max(1,box.height));camera.updateProjectionMatrix();render();
}
function render(){
  if(!renderer||!runtime?.ready)return;
  const t=Math.min(PERFORMANCE_SECONDS,elapsed),sample=samplePerformance(t,1),result=runtime.sample(sample,REVIEW_WEAPONS.sword);
  weapon.matrix.fromArray(result.sm);weapon.matrixWorldNeedsUpdate=true;weapon.visible=true;
  shadow.position.set(sample.x,.025,sample.z);
  const next=runtime.focus(false);const delta=next.clone().sub(focus).multiplyScalar(.14);focus.add(delta);camera.position.add(delta);controls.target.add(delta);controls.update();
  renderer.render(scene,camera);
  timeline.value=String(t);phase.textContent=result.label;timeLabel.textContent=`${t.toFixed(1)} / ${PERFORMANCE_SECONDS.toFixed(1)} 秒`;
}
function seek(value){elapsed=Math.min(PERFORMANCE_SECONDS,Math.max(0,Number(value)||0));playing=false;syncPlay();render();}
function loop(now){
  const dt=last?Math.min(.2,(now-last)/1000):0;last=now;
  if(!document.hidden&&playing&&runtime?.ready){elapsed+=dt*Number(speed.value||1);if(elapsed>=PERFORMANCE_SECONDS)elapsed=0;render();}
  frame=requestAnimationFrame(loop);
}
async function start(){
  try{
    setStatus('Knightを読み込んでいます。初回だけ数秒かかる場合があります。');
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    scene.add(new T.HemisphereLight('#d8eafa','#5d6258',1.9));
    const key=new T.DirectionalLight('#fff0d3',2.6);key.position.set(-3,5,4);scene.add(key);
    const rim=new T.DirectionalLight('#91b8d7',.9);rim.position.set(3,2,-3);scene.add(rim);
    const floor=new T.Mesh(new T.PlaneGeometry(24,24),new T.MeshStandardMaterial({color:'#223139',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.02;scene.add(floor);
    const grid=new T.GridHelper(12,24,'#5d7176','#30454b');grid.position.y=.023;scene.add(grid);
    shadow=new T.Mesh(new T.CircleGeometry(.48,40),new T.MeshBasicMaterial({color:'#081217',transparent:true,opacity:.3,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.65;scene.add(shadow);
    controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.4;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.49;
    runtime=new CompactPerformanceRuntime(scene);await runtime.load();runtime.setVisible(true);
    weapon=createReviewWeapon('sword');weapon.matrixAutoUpdate=false;scene.add(weapon);
    for(const id of ['performance-play','performance-restart','performance-timeline','performance-speed'])$(id).disabled=false;
    setStatus(`確認できます · ${COMPACT_PERFORMANCE_MODEL.label} · ${COMPACT_PERFORMANCE_REVISION} / ${PERFORMANCE_REVISION}`);
    setView('three');resize();syncPlay();render();frame=requestAnimationFrame(loop);
  }catch(error){console.error(error);setStatus(`表示できませんでした: ${error.message}`,true);retry.hidden=false;}
}

play.addEventListener('click',()=>{playing=!playing;if(playing&&elapsed>=PERFORMANCE_SECONDS)elapsed=0;last=0;syncPlay();});
restart.addEventListener('click',()=>{elapsed=0;playing=true;last=0;syncPlay();render();});
timeline.addEventListener('input',e=>seek(e.target.value));
speed.addEventListener('change',()=>{last=0;});
retry.addEventListener('click',()=>location.reload());
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{last=0;});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();playing=false;syncPlay();setStatus('描画が中断しました。再読み込みしてください。',true);retry.hidden=false;});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);controls?.dispose();runtime?.dispose();scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose?.();});renderer?.dispose();});

timeline.max=String(PERFORMANCE_SECONDS);
start();
