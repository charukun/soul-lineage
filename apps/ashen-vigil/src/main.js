import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Assets} from './assets.js';
import {Actors} from './actors.js';
import {buildWorld} from './world.js';
import {Effects} from './effects.js';
import {Battle,HEROES} from './game.js';
import {Interface} from './interface.js';
import {Audio} from './audio.js';
const $=id=>document.getElementById(id);
const debug={ready:false,error:null,generatedModels:0,modelsLoaded:0,frames:0,revision:THREE.REVISION};
Object.defineProperty(window,'__ASHEN__',{value:debug,writable:false});
async function boot(){
  const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,powerPreference:'high-performance'});
  const gl=renderer.getContext(),gpuInfo=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=gpuInfo?String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)):'';
  const lowPower=/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(gpu);
  renderer.setPixelRatio(lowPower?.65:Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.6));renderer.setSize(innerWidth,innerHeight,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#193e44');scene.fog=new THREE.FogExp2('#193e44',.033);
  const camera=new THREE.OrthographicCamera(-18,18,12,-12,.1,130);camera.position.set(18,24,20);camera.lookAt(0,0,0);
  const composer=lowPower?null:new EffectComposer(renderer);
  if(composer){composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.45,1.03));composer.addPass(new OutputPass());}
  renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;
  const assets=new Assets();await assets.load((p,key)=>{$('loadbar').style.width=(p*93)+'%';$('loadtext').textContent=Math.round(p*100)+'% — '+(key.startsWith('pirate/Characters')?'巡礼者を呼び起こしています':'忘れられた聖域を読み込んでいます');});
  const world=buildWorld(scene,assets,lowPower),actors=new Actors(scene,assets),effects=new Effects($('effects')),audio=new Audio(),game=new Battle();
  let elapsed=0,last=performance.now(),modeBlend=1,frameClock=0,frameCount=0,fps=0,shadowClock=0;
  const demo=new Battle(846);demo.start();demo.units=demo.heroes;demo.pendingSpawns=0;demo.state='title';demo.drain();
  demo.heroes.forEach((u,i)=>{u.x=3+(i-1)*2;u.z=1.7+(i===1?-.7:0);u.angle=.5;u.action='Idle';});
  const ui=new Interface(game,{start(){actors.clear();effects.items=[];game.start();modeBlend=1;ui.reset();if(audio.enabled)audio.unlock();},home(){actors.clear();effects.items=[];game.state='title';ui.reset();},sound:()=>audio.toggle()});
  const portraits=new THREE.Scene();portraits.add(new THREE.HemisphereLight('#e5fffb','#243944',3));const portraitLight=new THREE.DirectionalLight('#fff0d3',4);portraitLight.position.set(3,5,4);portraits.add(portraitLight);
  const pcamera=new THREE.PerspectiveCamera(31,1, .1,50);pcamera.position.set(0,1.6,5.2);pcamera.lookAt(0,1.35,0);
  const target=new THREE.WebGLRenderTarget(160,160),pixels=new Uint8Array(160*160*4),canvas=document.createElement('canvas');canvas.width=canvas.height=160;const context=canvas.getContext('2d');
  const previousClear=renderer.getClearColor(new THREE.Color()).clone();
  for(const h of HEROES){
    const model=assets.instance('pirate/'+h.model),b=new THREE.Box3().setFromObject(model),s=2/b.getSize(new THREE.Vector3()).y;model.scale.setScalar(s);model.position.y=-b.min.y*s;model.rotation.y=-.25;portraits.add(model);const mixer=new THREE.AnimationMixer(model),clip=assets.models.get('pirate/'+h.model).animations.find(a=>a.name==='Idle');if(clip){mixer.clipAction(clip).play();mixer.update(.3);}renderer.setRenderTarget(target);renderer.setClearColor('#173136',1);renderer.render(portraits,pcamera);renderer.readRenderTargetPixels(target,0,0,160,160,pixels);const image=context.createImageData(160,160);for(let y=0;y<160;y++)image.data.set(pixels.subarray((159-y)*640,(160-y)*640),y*640);context.putImageData(image,0,0);$('portrait-'+h.kind).src=canvas.toDataURL();portraits.remove(model);mixer.stopAllAction();mixer.uncacheRoot(model);
  }
  renderer.setRenderTarget(null);renderer.setClearColor(previousClear,1);target.dispose();
  function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);composer?.setSize(w,h);effects.resize(w,h);}
  resize();window.addEventListener('resize',resize);
  let pointer=null;
  $('scene').addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY};});
  $('scene').addEventListener('pointerup',e=>{if(!pointer||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>15)return;pointer=null;if(game.state!=='combat')return;const mouse=new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);const hit=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit))game.order(hit.x,hit.z);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['combat','choice'].includes(game.state))game.togglePause();last=performance.now();});
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();showError('描画の接続が中断されました。再読み込みで、もう一度灯をともせます。');});
  debug.modelsLoaded=assets.loaded;debug.modelsTotal=assets.total;debug.sourceManifest=assets.manifest.sourceCommit;debug.snapshot=()=>({...game.snapshot(),fps,quality:lowPower?'adaptive-software':'high',gpu,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,animations:[...actors.animationClips],renderedActors:actors.items.size,ready:debug.ready});
  function frame(now){
    requestAnimationFrame(frame);const wallDt=Math.max(0,(now-last)/1000),realDt=Math.min(wallDt,.25);last=now;const paused=game.state==='paused';const dt=paused?0:realDt;elapsed+=dt;
    const title=game.state==='title';modeBlend=THREE.MathUtils.damp(modeBlend,title?1:0,2.7,realDt);
    const units=title?demo.heroes:game.units;
    if(!title){let simulation=dt*game.speed;while(simulation>0){const slice=Math.min(.033,simulation);game.step(slice);simulation-=slice;}for(const event of game.drain()){effects.event(event);audio.event(event);ui.event(event);}}
    actors.update(units,dt*(title?1:game.speed));world.update(elapsed);audio.update(dt);ui.update(dt);
    const aspect=innerWidth/innerHeight;const view=aspect<.85?35:aspect<1.4?28:24;const span=view*(1-modeBlend*.12);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
    const focus=new THREE.Vector3(modeBlend*(aspect>.9?-2.1:1),.35,-.4),angle=.69+Math.sin(elapsed*.085)*.035*modeBlend;const shake=effects.shake;camera.position.set(focus.x+Math.sin(angle)*30+(Math.random()-.5)*shake,23+focus.y,focus.z+Math.cos(angle)*30+(Math.random()-.5)*shake);camera.lookAt(focus);camera.updateMatrixWorld();
    renderer.info.reset();shadowClock-=realDt;if(shadowClock<=0){renderer.shadowMap.needsUpdate=true;shadowClock=lowPower?.3:.07;}
    if(composer)composer.render();else renderer.render(scene,camera);effects.render(camera,units,elapsed,dt,world.flames,!title);debug.frames++;frameClock+=wallDt;frameCount++;if(frameClock>=1){fps=Math.round(frameCount/frameClock);frameClock=0;frameCount=0;}
  }
  $('loadbar').style.width='100%';$('loading').classList.add('hidden');$('title').classList.remove('hidden');debug.ready=true;last=performance.now();requestAnimationFrame(frame);
}
function showError(message){debug.error=message;$('loading').classList.add('hidden');$('error').classList.remove('hidden');$('error-text').textContent=message;}
boot().catch(error=>{console.error(error);showError(error.message||'WebGL2に対応したブラウザで再度開いてください。');});
