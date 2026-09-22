import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createReviewRenderer,positionReviewCamera} from '@soul/rendering';
import {createCameraDirector} from '@soul/rendering/camera-director';
import {applyCameraPresentation,actorScreenSafety} from '@soul/rendering/camera-presentation-three';
import {createReviewStageLifecycle,mountReviewShell,mountReviewStageControls} from '@soul/shared-ui/review-shell';
import {REVIEW_ROUTES} from './review-lab-config.js';
import {characterForgeCandidates} from '../../../packages/assets/generated/create-forge-registry.js';
import {createCharacterPackageActor} from '../../../packages/assets/src/character-create-forge/actor.js';

const panel=document.querySelector('.forge-panel'),$=selector=>panel.querySelector(selector);
const labels={model:'モデル',front:'正面',side:'側面',back:'背面',turntable:'360°',free:'自由視点'};
const motionLabels={Idle:'待機',Walk:'歩く',Talk:'話す',Attack:'攻撃',Hit:'被弾',Rest:'休む',Run:'走る',Pickup:'拾う',Jump:'ジャンプ',Fall:'落下'};
const status=message=>$('.forge-status').textContent=message;

function start(){
  const shell=mountReviewShell({current:'forge',routes:REVIEW_ROUTES,homeHref:new URL('./',location.href).href});
  const stageControls=mountReviewStageControls({stage:$('.forge-stage'),groups:['.forge-camera-tools','.forge-advanced'],label:'モデルの表示設定'});
  const canvas=$('#forge-stage'),renderer=createReviewRenderer(canvas,{exposure:1.2});
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e9edef');
  const camera=new THREE.PerspectiveCamera(6,1,.01,1000);
  const orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.minDistance=.18;orbit.maxDistance=500;
  scene.add(new THREE.HemisphereLight('#fff6df','#557481',2.4));
  const sun=new THREE.DirectionalLight('#ffdeb0',3);sun.position.set(-5,9,8);scene.add(sun);
  const fill=new THREE.DirectionalLight('#8cd6ec',2);fill.position.set(8,5,-8);scene.add(fill);
  const director=createCameraDirector({profile:'current3d'});
  // Shared framing uses only package bounds, unaffected by debug axes/equipment.
  const frameGeometry=new THREE.BoxGeometry(1,1,1),frameMaterial=new THREE.MeshBasicMaterial();
  const frameRoot=new THREE.Mesh(frameGeometry,frameMaterial);
  let comparing=false;
  let actor=null,entry=null,sequence=0,alive=true,turntable=false,paused=false,angle=0,view='front',referenceView='front',raf=0,last=performance.now(),loadController;
  const controls=[...panel.querySelectorAll('.forge-primary button,.forge-primary select,.forge-settings input,.forge-settings select')];
  const enable=ready=>controls.forEach(control=>control.disabled=!ready);
  enable(false);

  function presentShot(){
    director.reset();
    const point=v=>({x:v.x,y:v.y,z:v.z});
    const shot=director.update({mode:'event',space:'character-review',actor:actor.cameraSubject(),aspect:camera.aspect,
      authoredShot:{position:point(camera.position),lookTarget:point(orbit.target),fov:camera.fov}},0);
    applyCameraPresentation(camera,shot);
  }
  function frame(preset){
    camera.fov=preset==='three-quarter'?38:6;camera.updateProjectionMatrix();
    positionReviewCamera({camera,controls:orbit,root:frameRoot,preset,padding:320/288,minDistance:.1,maxDistance:500});
    presentShot();
  }
  function updateViewUI(){
    panel.dataset.view=view;
    for(const b of panel.querySelectorAll('[data-forge-view]'))b.setAttribute('aria-pressed',String(b.dataset.forgeView===view));
    $('[data-forge-turntable]').setAttribute('aria-pressed',String(turntable));
    $('[data-forge-render-label]').textContent='生成3D · '+labels[view];
  }
  function overlay(enabled){
    const available=comparing&&Boolean(entry?.references[referenceView])&&['front','side','back'].includes(view)&&actor?.action==='Bind';
    const checked=Boolean(enabled&&available);
    $('[data-forge-overlay]').checked=checked;$('[data-forge-overlay]').disabled=!available;
    $('[data-forge-overlay-image]').hidden=!checked;$('[data-forge-opacity-label]').hidden=!checked;
    $('.forge-comparison').dataset.overlay=String(checked);
  }
  function setComparison(enabled){
    comparing=Boolean(enabled);panel.dataset.comparing=String(comparing);
    $('[data-forge-compare]').setAttribute('aria-pressed',String(comparing));
    $('.forge-reference-pane').hidden=!comparing;
    if(comparing){compare(['front','side','back'].includes(view)?view:referenceView);return;}
    overlay(false);turntable=false;angle=0;view='model';
    if(actor){actor.root.rotation.y=0;frame('three-quarter');}
    updateViewUI();
  }
  function motionUI(){
    $('[data-forge-animation]').value=actor?.action||'Bind';
    $('[data-forge-pause]').hidden=!actor||actor.action==='Bind';
    $('[data-forge-pause]').textContent=paused?'再生':'一時停止';
  }
  function compare(direction){
    if(!actor)return;
    view=referenceView=direction;turntable=false;paused=false;angle=0;actor.setPaused(false);actor.neutral();
    const url=entry.references[direction];
    for(const selector of ['[data-forge-reference]','[data-forge-overlay-image]']){
      if(url)$(selector).src=url;else $(selector).removeAttribute('src');
    }
    $('[data-forge-reference]').hidden=!url;$('[data-forge-missing]').hidden=Boolean(url);
    $('[data-forge-original]').href=entry.sourceReferences[direction]||entry.sourceReferences.front;
    $('[data-forge-ref-label]').textContent='元の三面図 · '+labels[direction]+(url?'':'（未観測）');
    motionUI();updateViewUI();overlay($('[data-forge-overlay]').checked);frame(direction);
  }
  function display(){
    actor?.setDisplay({texture:$('[data-forge-texture]').checked,wireframe:$('[data-forge-wire]').checked,
      skeleton:$('[data-forge-skeleton]').checked,socket:$('[data-forge-sockets]').checked});
  }
  function showInputImages(candidate){
    const names={front:'正面',front34:'前斜め',side:'側面',back34:'後斜め',back:'背面'};
    const images=[];
    for(const [direction,name] of Object.entries(names)){
      const url=candidate.sourceReferences?.[direction];if(!url)continue;
      const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';
      link.title=name+'の入力画像を開く';link.setAttribute('aria-label',link.title);
      const img=document.createElement('img');img.src=url;img.alt=candidate.manifest.displayName+'の入力画像（'+name+'）';img.decoding='async';
      link.append(img,document.createTextNode(name));images.push(link);
    }
    $('[data-forge-input-images]').replaceChildren(...images);
    $('.forge-input-preview').hidden=images.length===0;
  }
  async function select(candidate){
    const token=++sequence;loadController?.abort();loadController=new AbortController();const signal=loadController.signal;
    delete panel.dataset.error;panel.dataset.ready='false';enable(false);status(candidate.manifest.displayName+'を読み込み中…');
    try{
      const response=await fetch(candidate.modelUrl,{signal});if(!response.ok)throw new Error('GLB HTTP '+response.status);
      const bytes=await response.arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==candidate.manifest.model.sha256)throw new Error('GLB hash mismatch');
      const gltf=await new GLTFLoader().parseAsync(bytes,''),next=createCharacterPackageActor(THREE,gltf,candidate.manifest);
      if(!alive||token!==sequence){next.dispose();return;}
      actor?.dispose();actor=next;entry=candidate;scene.add(actor.root,actor.helper);showInputImages(candidate);
      const bounds=candidate.manifest.bounds;
      frameRoot.position.fromArray(bounds.min.map((v,i)=>(v+bounds.max[i])*.5));
      frameRoot.scale.fromArray(bounds.min.map((v,i)=>bounds.max[i]-v));frameRoot.updateMatrixWorld(true);
      $('[data-forge-animation]').replaceChildren(new Option('基準姿勢','Bind'),...candidate.manifest.animations.map(c=>new Option(motionLabels[c.name]||c.name,c.name)));
      actor.setEquipment({weapon:$('[data-forge-equipment]').value||null});display();enable(true);compare('front');if(!comparing)setComparison(false);panel.dataset.ready='true';
      for(const b of panel.querySelectorAll('[data-forge-candidate]'))b.setAttribute('aria-pressed',String(b.dataset.forgeCandidate===candidate.manifest.id));
      const mode={'single-view':'1枚から生成','multi-view':'三面図から生成','enhanced-multi-view':'5方向から生成'}[candidate.manifest.reconstructionMode];
      status(candidate.manifest.displayName+' · '+mode+' · '+(candidate.manifest.reviewStatus==='approved'?'承認済み':'確認候補・未承認'));
      $('.forge-readout').textContent='検証レポートを読み込み中…';
      const report=await fetch(candidate.reportUrl,{signal}).then(r=>{if(!r.ok)throw new Error('Report HTTP '+r.status);return r.json();});
      if(!alive||token!==sequence)return;
      $('.forge-readout').textContent=JSON.stringify({provenance:candidate.manifest.provenance,performance:report.performance,comparisons:report.comparisons,warnings:report.warnings,limitations:report.limitations},null,2);
    }catch(error){
      if(alive&&token===sequence&&error.name!=='AbortError'){
        panel.dataset.error=error.message;status('読み込みに失敗しました。キャラを選び直してください。 '+error.message);
        enable(Boolean(actor));overlay(false);
      }
    }
  }

  for(const candidate of characterForgeCandidates){
    const button=document.createElement('button');button.type='button';button.dataset.forgeCandidate=candidate.manifest.id;button.setAttribute('aria-pressed','false');
    const img=document.createElement('img');img.src=candidate.references.front;img.alt='';
    button.append(img,document.createTextNode(candidate.manifest.displayName));button.onclick=()=>void select(candidate);$('.forge-candidates').append(button);
  }
  panel.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!actor)return;
    if(button.hasAttribute('data-forge-compare'))setComparison(!comparing);
    if(button.dataset.forgeView)compare(button.dataset.forgeView);
    if(button.hasAttribute('data-forge-pause')){paused=!paused;actor.setPaused(paused);motionUI();}
    if(button.hasAttribute('data-forge-turntable')){
      if(turntable){compare(referenceView);return;}
      setComparison(false);turntable=true;angle=0;view='turntable';actor.root.rotation.y=0;overlay(false);updateViewUI();frame('three-quarter');
    }
  });
  $('[data-forge-animation]').onchange=event=>{
    if(!actor)return;
    if(event.target.value==='Bind'){compare(referenceView);return;}
    actor.play(event.target.value);paused=false;actor.setPaused(false);motionUI();overlay(false);
  };
  $('[data-forge-equipment]').onchange=event=>actor?.setEquipment({weapon:event.target.value||null});
  for(const selector of ['texture','wire','skeleton','sockets'])$('[data-forge-'+selector+']').onchange=display;
  $('[data-forge-overlay]').onchange=event=>overlay(event.target.checked);
  $('[data-forge-opacity]').oninput=event=>$('.forge-comparison').style.setProperty('--forge-opacity',event.target.value);
  orbit.addEventListener('start',()=>{if(actor){turntable=false;view='free';overlay(false);updateViewUI();}});
  const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.parentElement,
    onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();if(actor){if(['front','side','back'].includes(view))frame(view);else if(view!=='free')frame('three-quarter');}},
    render:()=>renderer.render(scene,camera)});
  function tick(now){
    if(!alive)return;raf=requestAnimationFrame(tick);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
    if(document.hidden)return;
    actor?.update(dt);if(actor&&turntable){angle+=dt*.7;actor.root.rotation.y=angle;}orbit.update();renderer.render(scene,camera);
  }
  canvas.characterForgeSnapshot=()=>actor?{...actor.snapshot(),view,comparing,turntable,angle,subject:actor.cameraSubject(),
    camera:camera.position.toArray(),cameraPresentation:director.snapshot(),screenSafety:actorScreenSafety(camera,[actor.cameraSubject()])}:null;
  raf=requestAnimationFrame(tick);
  const requested=new URLSearchParams(location.search).get('character');
  const initial=characterForgeCandidates.find(c=>c.manifest.id===requested)||characterForgeCandidates[0];
  if(initial)void select(initial);else status('生成候補はありません。Forgeでキャラを生成すると、ここに自動で表示されます。');
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    alive=false;sequence++;loadController?.abort();cancelAnimationFrame(raf);stageLifecycle.destroy();orbit.dispose();actor?.dispose();
    frameGeometry.dispose();frameMaterial.dispose();stageControls?.destroy();shell?.destroy();renderer.dispose();
  });
}
try{start();}catch(error){panel.dataset.error=error.message;status('3D表示を開始できませんでした。 '+error.message);}

