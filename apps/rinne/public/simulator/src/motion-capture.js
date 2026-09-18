import * as T from '../vendor/three.js';
import {HumanoidRuntime} from './humanoid.js';
import {SLASH_TIMING,SLASH_SECONDS,SLASH_REVISION} from './authored-slash.js';
import {createReviewSword} from './review-sword.js';

const canvas=document.getElementById('motion-capture-stage');
const statusNode=document.getElementById('motion-capture-status');
const scene=new T.Scene();
scene.background=new T.Color('#25343c');
scene.fog=new T.Fog('#25343c',8,16);
const camera=new T.PerspectiveCamera(35,16/9,.05,30);
let renderer=null,runtime=null,capturePromise=null,captureSnapshot={ready:false,capturing:false,done:false,error:null,frame:0,frames:0,fps:30,duration:30};

const actor={
  id:'motion-capture-shino',hero:true,weapon:'sword',weaponDraw:0,lifeAgeYears:22,
  x:0,z:0,yaw:0,air:0,vx:0,vz:0,_humanoidClock:0,_humanoidPhase:0,
  combatReady:false,weaponTransition:false,attack:null,parryMotion:null,zanshin:null,
};
const sword=createReviewSword();
sword.matrixAutoUpdate=false;
scene.add(sword);

function setStatus(message,ready=captureSnapshot.ready){
  statusNode.textContent=message;
  statusNode.dataset.ready=String(Boolean(ready));
}

async function readAsset(_id,file){
  const url=new URL(file,location.href);
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Asset ${file} returned HTTP ${response.status}`);
  return response.arrayBuffer();
}

const api={
  readAsset,
  weapons:{sword:{base:.21,tip:1.62,width:.065}},
  strikes:{slash:{}},
  clips:{slash:SLASH_TIMING},
  windows:{},
  progress:(a,t)=>Math.min(1,Math.max(0,(t??a.attack?.t??0)/SLASH_SECONDS)),
  window:(_kind,p)=>p>=SLASH_TIMING.active[0]&&p<=SLASH_TIMING.active[1]?0:-1,
  attach:c=>scene.add(c.root),
  status:message=>setStatus(message,false),
};

function resize(){
  if(!renderer)return;
  const width=Math.max(1,canvas.clientWidth||1280),height=Math.max(1,canvas.clientHeight||720);
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
}

function frameCamera(){
  const target=new T.Vector3(0,1.10,.28),distance=5.15,yaw=.64;
  camera.position.set(Math.sin(yaw)*distance,1.92,.28+Math.cos(yaw)*distance);
  camera.lookAt(target);
}

function clearTransientState(){
  actor.attack=null;
  actor.parryMotion=null;
  actor.zanshin=null;
  actor.reaction=null;
  actor.recovery=null;
  actor.dead=false;
}

function resetPresentationHistory(){
  const c=runtime?.current;
  if(!c)return;
  c.state=null;
  c.lastActual=null;
  c.blending=null;
  c.footLocks={};
  c.lastCommittedRoot=null;
  c.lastDrawClock=-1;
  c.resetSpring=true;
}

function applyFrame(state){
  if(!runtime?.ready||!renderer)throw new Error('Shino runtime is not ready');
  clearTransientState();
  actor._humanoidClock=Number(state.time)||0;
  actor._humanoidPhase=Number.isFinite(state.humanoidPhase)?state.humanoidPhase:actor._humanoidClock;
  actor.vx=Number(state.vx)||0;
  actor.vz=Number(state.vz)||0;
  actor.weaponDraw=Math.min(1,Math.max(0,Number(state.weaponDraw)||0));
  actor.combatReady=Boolean(state.combatReady);
  actor.weaponTransition=Boolean(state.weaponTransition);
  if(state.attack)actor.attack={...state.attack};
  if(state.parryMotion)actor.parryMotion={...state.parryMotion};
  if(state.zanshin)actor.zanshin={...state.zanshin};
  const result=runtime.render(actor);
  if(!result?.sm)throw new Error('Motion runtime did not return a sword transform');
  sword.matrix.fromArray(result.sm);
  sword.matrixWorldNeedsUpdate=true;
  renderer.render(scene,camera);
  setStatus(`${state.label||'motion'} · ${actor._humanoidClock.toFixed(2)}s`,true);
  return result;
}

function preferredMimeType(){
  for(const type of ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']){
    if(globalThis.MediaRecorder?.isTypeSupported?.(type))return type;
  }
  return '';
}

async function capture({frames,fps=30,duration=30,fileName='rinne-shino-motion.webm'}={}){
  if(capturePromise)return capturePromise;
  if(!captureSnapshot.ready)throw new Error('Shino capture surface is not ready');
  if(!Array.isArray(frames)||frames.length<2)throw new Error('Motion capture frames are required');
  if(!Number.isFinite(fps)||fps<=0||!Number.isFinite(duration)||duration<=0)throw new Error('Invalid motion capture timing');
  if(typeof canvas.captureStream!=='function'||typeof MediaRecorder==='undefined')throw new Error('Canvas MediaRecorder is unavailable');
  captureSnapshot={...captureSnapshot,capturing:true,done:false,error:null,frame:0,frames:frames.length,fps,duration};
  resetPresentationHistory();
  applyFrame(frames[0]);
  const stream=canvas.captureStream(fps),mimeType=preferredMimeType(),chunks=[];
  const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
  capturePromise=new Promise((resolve,reject)=>{
    let raf=0,startAt=0,stopping=false;
    const fail=error=>{
      cancelAnimationFrame(raf);
      for(const track of stream.getTracks())track.stop();
      captureSnapshot={...captureSnapshot,capturing:false,error:String(error?.message||error)};
      capturePromise=null;
      reject(error instanceof Error?error:new Error(String(error)));
    };
    recorder.onerror=event=>fail(event.error||new Error('MediaRecorder failed'));
    recorder.onstop=()=>{
      try{
        cancelAnimationFrame(raf);
        for(const track of stream.getTracks())track.stop();
        const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
        if(!blob.size)throw new Error('Recorded Shino video is empty');
        const href=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=href;link.download=fileName;link.hidden=true;document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(href),1000);
        captureSnapshot={...captureSnapshot,capturing:false,done:true,bytes:blob.size,mimeType:blob.type,frame:frames.length-1};
        setStatus(`録画完了 · ${(blob.size/1024/1024).toFixed(1)} MB`,true);
        const result={...captureSnapshot,revision:SLASH_REVISION,model:'SHINO'};
        capturePromise=null;
        resolve(result);
      }catch(error){fail(error);}
    };
    const tick=now=>{
      try{
        if(!startAt)startAt=now;
        const elapsed=Math.min(duration,(now-startAt)/1000),index=Math.min(frames.length-1,Math.floor(elapsed*fps));
        captureSnapshot.frame=index;
        applyFrame(frames[index]);
        if(elapsed>=duration){
          if(!stopping){stopping=true;recorder.requestData();recorder.stop();}
          return;
        }
        raf=requestAnimationFrame(tick);
      }catch(error){fail(error);}
    };
    recorder.start(250);
    raf=requestAnimationFrame(tick);
  });
  return capturePromise;
}

window.__RINNE_MOTION_CAPTURE__={
  get ready(){return captureSnapshot.ready;},
  get done(){return captureSnapshot.done;},
  snapshot:()=>({...captureSnapshot,model:'SHINO',revision:SLASH_REVISION,slashSeconds:SLASH_SECONDS}),
  render:state=>applyFrame(state),
  capture,
};

async function start(){
  try{
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);
    renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    scene.add(new T.HemisphereLight('#d8eafa','#676552',2.0));
    const key=new T.DirectionalLight('#fff0d3',2.7);key.position.set(-3,5,4);scene.add(key);
    const rim=new T.DirectionalLight('#a8cae7',1.0);rim.position.set(3,2,-3);scene.add(rim);
    const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.MeshStandardMaterial({color:'#263a40',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.02;scene.add(floor);
    const grid=new T.GridHelper(12,24,'#637779','#364f55');grid.position.y=.022;scene.add(grid);
    const shadow=new T.Mesh(new T.CircleGeometry(.48,48),new T.MeshBasicMaterial({color:'#0c1a20',transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.scale.y=.65;shadow.position.set(0,.025,0);scene.add(shadow);
    frameCamera();resize();
    runtime=new HumanoidRuntime(api);
    await runtime.load('SHINO');
    captureSnapshot={...captureSnapshot,ready:true};
    applyFrame({time:0,humanoidPhase:0,vx:0,vz:0,weaponDraw:0,combatReady:false,weaponTransition:false,label:'idle'});
    setStatus(`しのちゃん準備完了 · ${SLASH_REVISION}`,true);
  }catch(error){
    captureSnapshot={...captureSnapshot,error:String(error?.message||error)};
    setStatus(`録画面の準備失敗: ${error.message}`,false);
    throw error;
  }
}

window.addEventListener('resize',resize);
window.addEventListener('pagehide',()=>{
  if(runtime?.current)runtime.dispose(runtime.current);
  scene.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material?.dispose?.();});
  renderer?.dispose();
});
start();
