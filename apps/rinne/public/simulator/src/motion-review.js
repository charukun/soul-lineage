import * as T from '../vendor/three.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {HumanoidRuntime} from './humanoid.js';
import {SLASH_SECONDS} from './authored-slash.js';
import {PERFORMANCE_SECONDS,SWORD_TIMINGS,applyPerformance} from './sword-performance.js';
import {SWORD_MOVES,SWORD_REVISION} from './authored-sword.js';
import {SHORT_SWORD_SECONDS,SHORT_SWORD_SEQUENCE,createSwordSequence,applySwordSequence,swordSequenceTravel} from './sword-sequence.js';
import {createReviewSword} from './review-sword.js';
const $=id=>document.getElementById(id),canvas=$('motion-stage');
let renderer,runtime,controls,shadow,frame=0,playing=true,last=0,elapsed=0;
const requestedMode=new URLSearchParams(location.search).get('mode');
let mode=requestedMode==='flow'?'combination':['combination','baseline','sequence','single'].includes(requestedMode)?requestedMode:'single';
let singleKind='slash';
const completeSequence=createSwordSequence(SHORT_SWORD_SEQUENCE.entries.map(row=>row.kind),{connected:false});
const shortMode=()=>mode==='combination'||mode==='baseline';
const duration=()=>mode==='baseline'?Math.max(SHORT_SWORD_SECONDS,completeSequence.duration+.3):mode==='combination'?SHORT_SWORD_SECONDS:mode==='sequence'?PERFORMANCE_SECONDS:SWORD_MOVES[singleKind].seconds;
const scene=new T.Scene();scene.background=new T.Color('#25343c');scene.fog=new T.Fog('#25343c',8,16);
const camera=new T.PerspectiveCamera(35,1,.05,30),focus=new T.Vector3(0,1.13,.3);
const actor={id:'motion-review-shino',hero:true,weapon:'sword',weaponDraw:1,lifeAgeYears:22,x:0,z:0,yaw:0,air:0,vx:0,vz:0,combatReady:true,_humanoidClock:0,attack:null};
const status=message=>{$('motion-status').textContent=message;};
const api={weapons:{sword:{base:.21,tip:1.62,width:.065}},strikes:{slash:{},back:{},uppercut:{},thrust:{},heavy:{}},clips:SWORD_TIMINGS,windows:{},
 progress:(a,t)=>Math.min(1,Math.max(0,(t??a.attack?.t??0)/(a.attack?.duration||SLASH_SECONDS))),
 window:(kind,p)=>{const active=SWORD_TIMINGS[kind]?.active;return active&&p>=active[0]&&p<=active[1]?0:-1;},
 attach:c=>scene.add(c.root),status};
const sword=createReviewSword();sword.matrixAutoUpdate=false;scene.add(sword);
// A short ribbon follows the actual blade sockets, never a canned effect clip.
const trailSamples=[],ribbonGeometry=new T.BufferGeometry(),positions=new Float32Array(17*18),colors=new Float32Array(17*18);
ribbonGeometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
ribbonGeometry.setAttribute('color',new T.BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage));ribbonGeometry.setDrawRange(0,0);
const ribbon=new T.Mesh(ribbonGeometry,new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.38,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));ribbon.frustumCulled=false;scene.add(ribbon);
function clearTrail(){trailSamples.length=0;ribbonGeometry.setDrawRange(0,0);}
function updateTrail(result,time){
 if(mode==='single'||!$('trail').checked){clearTrail();return;}
 while(trailSamples.length&&time-trailSamples[0].time>.11)trailSamples.shift();
 if(result.active&&(!trailSamples.length||time>trailSamples.at(-1).time+1e-5))trailSamples.push({base:result.weaponBase,tip:result.weaponTip,time});
 while(trailSamples.length>18)trailSamples.shift();
 let n=0;const vertex=(sample,key)=>{positions.set(sample[key],n*3);const fade=Math.max(0,1-(time-sample.time)/.11);colors.set([fade,.76*fade,.34*fade],n++*3);};
 for(let i=1;i<trailSamples.length;i++){const a=trailSamples[i-1],b=trailSamples[i];vertex(a,'base');vertex(a,'tip');vertex(b,'tip');vertex(a,'base');vertex(b,'tip');vertex(b,'base');}
 ribbonGeometry.setDrawRange(0,n);ribbonGeometry.attributes.position.needsUpdate=true;ribbonGeometry.attributes.color.needsUpdate=true;
}
function syncReference(time,force=false){
 const video=$('reference-video');
 if(!$('compare-reference').checked||!shortMode()){video.pause();return;}
 video.playbackRate=Number($('speed').value);
 if(video.readyState&& (force||Math.abs(video.currentTime-time)>.12))video.currentTime=Math.min(SHORT_SWORD_SECONDS-.001,time);
 if(playing&&time<SHORT_SWORD_SECONDS){if(video.paused)video.play().catch(()=>{});}else video.pause();
}
function toggleReference(){
 const open=$('compare-reference').checked&&shortMode();$('reference-panel').hidden=!open;
 if(open&&!$('reference-video').getAttribute('src'))$('reference-video').src='./assets/review/reference-sword-4s.mp4';
 syncReference(Math.min(duration(),elapsed),true);resize();
}
function phaseLabel(p){return p<.12?'構え':p<.34?'溜め':p<.46?'踏み込み':p<.60?'斬撃':p<.82?'振り抜き':'構えへ';}
function pose(time){
 let label;
 if(shortMode()){
  Object.assign(actor,{x:0,z:0,yaw:0,vx:0,vz:0,_humanoidClock:time,_humanoidPhase:0});
  const sequence=mode==='combination'?SHORT_SWORD_SEQUENCE:completeSequence;
  const f=applySwordSequence(actor,sequence,time,{start:.3});Object.assign(actor,swordSequenceTravel(sequence,time-.3,runtime.current.unit*runtime.current.legLength/.82));label=f.current.label+(f.previous?' · '+f.previous.label+'から接続':'');
 }else if(mode==='sequence')label=applyPerformance(actor,time,runtime.current.locomotion,runtime.current.unit*runtime.current.legLength/.82).event.label;
 else{Object.assign(actor,{x:0,z:0,yaw:0,vx:0,vz:0,_humanoidClock:time,_humanoidPhase:0,motionBlend:null,motionSequence:false,attack:{id:'single-'+singleKind,kind:singleKind,t:time,duration:SWORD_MOVES[singleKind].seconds}});label=SWORD_MOVES[singleKind].label+' · '+phaseLabel(time/SWORD_MOVES[singleKind].seconds);}
 return {result:runtime.render(actor),label};
}
function focusTarget(){const hips=runtime?.current?.raw?.hips?.getWorldPosition(new T.Vector3());return new T.Vector3(hips?.x??actor.x,1.13,(hips?.z??actor.z)+.25);}
function follow(snap=false){
 const target=focusTarget(),next=snap?target:focus.clone().lerp(target,.18),delta=next.clone().sub(focus);
 camera.position.add(delta);controls.target.add(delta);focus.copy(next);
}
function render(){
 if(!runtime?.ready||!renderer)return;
 const time=Math.min(duration(),elapsed),{result,label}=pose(time);
 sword.matrix.fromArray(result.sm);sword.matrixWorldNeedsUpdate=true;shadow.position.set(actor.x,.025,actor.z);
 updateTrail(result,time);syncReference(time);follow();controls.update();renderer.render(scene,camera);
 $('timeline').value=String(time);$('phase-label').textContent=label;$('time-label').textContent=`${time.toFixed(1)} / ${duration().toFixed(1)} 秒`;
}
function resetContacts(){clearTrail();if(runtime?.current){const c=runtime.current;if(c.blending){c.mixer.uncacheClip(c.blending.clip);c.actions.delete(c.blending.clip.uuid);}c.state=null;c.lastActual=null;c.blending=null;c.footLocks={};c.resetSpring=true;}}
function prepareAt(time){
 resetContacts();if(!runtime?.ready)return;
 // Rebuild only the recent transition window. Seeking is independent of the
 // previous scrub position and never walks all 30 seconds on a phone.
 const start=Math.max(0,time-.3);
 for(let t=start;t<time;t+=1/60)pose(t);
 pose(time);follow(true);
}
function seek(time){playing=false;elapsed=Math.min(duration(),Math.max(0,time));prepareAt(elapsed);syncPlay();render();}
function syncPlay(){$('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-pressed',String(playing));syncReference(Math.min(duration(),elapsed),true);}
function fittedDistance(){return Math.max(shortMode()?5.8:4.9,1.7/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect)+.65);}
function view(id){if(!controls)return;const distance=fittedDistance(),yaw=({three:.72,front:0,side:Math.PI/2,back:Math.PI})[id]??.72;focus.copy(focusTarget());camera.position.set(focus.x+Math.sin(yaw)*distance,focus.y+distance*.16,focus.z+Math.cos(yaw)*distance);controls.target.copy(focus);controls.update();for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===id));render();}
function resize(){if(!renderer)return;const box=canvas.parentElement.getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/Math.max(1,box.height);camera.updateProjectionMatrix();if(controls){const offset=camera.position.clone().sub(controls.target).normalize();camera.position.copy(controls.target).addScaledVector(offset,fittedDistance());controls.update();}render();}
function configure(){
 $('mode').value=mode;$('single-kind').value=singleKind;$('single-kind-row').hidden=mode!=='single';$('timeline').max=String(duration());$('trail').disabled=mode==='single';$('compare-reference').disabled=!shortMode();if(!shortMode())$('compare-reference').checked=false;toggleReference();
 $('motion-version').textContent=`${SWORD_REVISION} · `+(shortMode()?`既存7連撃 / ${duration().toFixed(1)}秒`:mode==='sequence'?'既存5技・29撃 / 30秒':SWORD_MOVES[singleKind].label);
 if(runtime?.ready)status(shortMode()?'既存の技を接続。単体モーションにも同じ改善が反映されています。':mode==='sequence'?'既存の技・歩行・走行を組み合わせた30秒演武。':'技構成と同じ共有モーションを単体で確認できます。');
}
function restart(){elapsed=0;prepareAt(0);playing=true;last=0;syncPlay();render();}
function loop(now){const dt=last?Math.min(.25,(now-last)/1000):0;last=now;
 if(!document.hidden&&playing&&runtime?.ready){elapsed+=dt*Number($('speed').value);
  if(elapsed>=duration()&& !$('repeat').checked){elapsed=duration();playing=false;syncPlay();}
  else if(elapsed>duration()+(mode==='single'?.32:.35)){elapsed=0;prepareAt(0);}
  render();
 }
 frame=requestAnimationFrame(loop);
}
async function start(){try{
 renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 scene.add(new T.HemisphereLight('#d8eafa','#676552',2.0));const light=new T.DirectionalLight('#fff0d3',2.7);light.position.set(-3,5,4);scene.add(light);const rim=new T.DirectionalLight('#a8cae7',1.0);rim.position.set(3,2,-3);scene.add(rim);
 const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#263a40',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.02;scene.add(floor);
 const grid=new T.GridHelper(12,24,'#637779','#364f55');grid.position.y=.022;scene.add(grid);
 shadow=new T.Mesh(new T.CircleGeometry(.48,48),new T.MeshBasicMaterial({color:'#0c1a20',transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.65;scene.add(shadow);
 controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=2.5;controls.maxDistance=16;controls.maxPolarAngle=Math.PI*.49;controls.enablePan=false;controls.addEventListener('change',()=>{if(!playing&&runtime?.ready)renderer.render(scene,camera);});
 runtime=new HumanoidRuntime(api);await runtime.load('SHINO');
 // Bake before playback so a new cut never stalls its first attack frame.
 for(const kind of Object.keys(api.clips))runtime.current.generated['sword:'+kind]??=runtime.bakeArmed(runtime.current,'sword',kind);
 for(const id of ['play','restart','previous-frame','next-frame','timeline'])$(id).disabled=false;
 configure();view('three');resize();syncPlay();frame=requestAnimationFrame(loop);
}catch(e){status(`表示できませんでした：${e.message}`);$('retry').hidden=false;}}
$('mode').onchange=e=>{mode=e.target.value;$('repeat').checked=!shortMode();const url=new URL(location.href);url.searchParams.set('mode',mode);window.history.replaceState(null,'',url);configure();restart();};
$('single-kind').onchange=e=>{singleKind=e.target.value;configure();restart();};
$('play').onclick=()=>{playing=!playing;if(playing&&elapsed>=duration()){elapsed=0;prepareAt(0);}last=0;syncPlay();};
$('restart').onclick=restart;$('timeline').oninput=e=>seek(Number(e.target.value));
$('previous-frame').onclick=()=>seek(Math.min(duration(),elapsed)-1/60);$('next-frame').onclick=()=>seek(Math.min(duration(),elapsed)+1/60);
$('compare-reference').onchange=toggleReference;$('speed').onchange=()=>syncReference(Math.min(duration(),elapsed),true);
$('reference-video').onloadedmetadata=()=>syncReference(Math.min(duration(),elapsed),true);
$('reference-video').onerror=()=>{$('reference-error').hidden=false;};
$('trail').onchange=()=>{clearTrail();render();};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);
$('retry').onclick=()=>location.reload();window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{last=0;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;syncPlay();status('描画が中断しました。再読み込みしてください。');$('retry').hidden=false;});
window.addEventListener('pageshow',e=>{if(e.persisted){last=0;frame=requestAnimationFrame(loop);resize();}});
window.addEventListener('pagehide',e=>{cancelAnimationFrame(frame);if(e.persisted)return;controls?.dispose();if(runtime?.current)runtime.dispose(runtime.current);scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});renderer?.dispose();});
if(shortMode()){$('repeat').checked=false;$('trail').checked=false;}
configure();start();
