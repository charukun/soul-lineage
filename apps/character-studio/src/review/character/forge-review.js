import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {positionReviewCamera} from '@soul/rendering';
import {characterForgeCandidates} from '../../../../../packages/assets/generated/create-forge-registry.js';
import {createCharacterPackageActor} from '../../../../../packages/assets/src/character-create-forge/actor.js';
import './forge-review.css';

export function mountCharacterForgeReview(review){
  const stage=review.presentationStage;if(!stage)return;
  const panel=document.createElement('section');panel.className='forge-panel';panel.setAttribute('aria-label','Character Create Forge');
  panel.innerHTML='<h3>Character Create Forge</h3><div class="forge-candidates"></div><p class="forge-status" role="status">生成候補を選んで三面図と比較します。</p><div class="forge-toolbar"><select aria-label="Forge animation" data-forge-animation></select><button type="button" data-forge-bind>基準姿勢</button><button type="button" data-forge-pause>一時停止</button><button type="button" data-forge-turntable>360°</button><button type="button" data-forge-exit>通常モデルへ</button></div><div class="forge-toolbar"><button type="button" data-forge-view="front">Front比較</button><button type="button" data-forge-view="side">Side比較</button><button type="button" data-forge-view="back">Back比較</button><label><input type="checkbox" data-forge-texture checked>Texture</label><label><input type="checkbox" data-forge-wire>Wireframe</label><label><input type="checkbox" data-forge-skeleton>Skeleton</label><label><input type="checkbox" data-forge-sockets>Sockets</label></div><div class="forge-toolbar"><label><input type="checkbox" data-forge-overlay>重ねる</label><input type="range" min="0" max="1" step=".05" value=".5" aria-label="比較の不透明度" data-forge-opacity><label>武器<select data-forge-equipment><option value="">なし</option><option value="sword">剣</option><option value="spear">槍</option></select></label></div><div class="forge-comparison"><figure><figcaption data-forge-ref-label>REFERENCE</figcaption><img data-forge-reference alt="正規化した三面図"></figure><figure><figcaption data-forge-render-label>GENERATED</figcaption><img data-forge-render alt="GLBの実表示"></figure></div><details><summary>出典・計測・制約</summary><a data-forge-original target="_blank" rel="noopener">原画像を見る</a><pre class="forge-readout"></pre></details>';
  document.querySelector('.review-controls').prepend(panel);
  const $=s=>panel.querySelector(s),status=message=>$('.forge-status').textContent=message;
  let actor=null,entry=null,sequence=0,turntable=false,paused=false,angle=0,selectedView='front';
  const original={fov:stage.camera.fov,far:stage.camera.far,background:stage.scene.background,maxDistance:stage.orbit.maxDistance};
  // Bounds proxy feeds the existing shared framing function. Debug axes and
  // socket markers must never change the character's comparison scale.
  const frameGeometry=new THREE.BoxGeometry(1,1,1),frameMaterial=new THREE.MeshBasicMaterial();
  const frameRoot=new THREE.Mesh(frameGeometry,frameMaterial);
  function display(){actor?.setDisplay({texture:$('[data-forge-texture]').checked,wireframe:$('[data-forge-wire]').checked,skeleton:$('[data-forge-skeleton]').checked,socket:$('[data-forge-sockets]').checked});}
  function restore(){stage.camera.fov=original.fov;stage.camera.far=original.far;stage.orbit.maxDistance=original.maxDistance;stage.camera.updateProjectionMatrix();stage.scene.background=original.background;for(const a of stage.actors())a.root.visible=true;stage.ground.visible=true;stage.marker.visible=true;}
  function deactivate(){sequence++;actor?.dispose();actor=null;entry=null;turntable=false;restore();panel.dataset.ready='false';}
  function aim(view='front'){
    if(!actor)return;selectedView=['side','back'].includes(view)?view:'front';actor.root.rotation.y=0;
    stage.camera.fov=1;stage.camera.far=1000;stage.orbit.maxDistance=500;stage.camera.updateProjectionMatrix();
    positionReviewCamera({camera:stage.camera,controls:stage.orbit,root:frameRoot,preset:selectedView,padding:320/288,minDistance:.1,maxDistance:500});
  }
  function comparison(view){
    if(!actor)return;turntable=false;actor.neutral();aim(view);const url=entry.references[selectedView];
    $('[data-forge-reference]').hidden=!url;if(url)$('[data-forge-reference]').src=url;
    $('[data-forge-original]').href=entry.sourceReferences[selectedView]||entry.sourceReferences.front;
    $('[data-forge-ref-label]').textContent='REFERENCE '+selectedView.toUpperCase()+(url?'':' — 未観測');
    $('[data-forge-render-label]').textContent='GENERATED '+selectedView.toUpperCase();
    // Use the delivered GLB, same renderer and shared camera framing. Square
    // comparison capture has fixed weak-perspective lens; restore viewport.
    const size=stage.renderer.getSize(new THREE.Vector2()),aspect=stage.camera.aspect;
    stage.renderer.setSize(320,320,false);stage.camera.aspect=1;stage.camera.updateProjectionMatrix();aim(view);
    stage.renderer.render(stage.scene,stage.camera);$('[data-forge-render]').src=stage.canvas.toDataURL('image/png');
    stage.renderer.setSize(size.x,size.y,false);stage.camera.aspect=aspect;stage.camera.updateProjectionMatrix();aim(view);
    panel.dataset.view=selectedView;
  }
  async function select(candidate){
    const token=++sequence;status('GLBを読み込み中…');
    try{
      const response=await fetch(candidate.modelUrl);if(!response.ok)throw new Error('GLB HTTP '+response.status);const bytes=await response.arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==candidate.manifest.model.sha256)throw new Error('GLB hash mismatch');
      const gltf=await new GLTFLoader().parseAsync(bytes,'');const next=createCharacterPackageActor(THREE,gltf,candidate.manifest);
      if(token!==sequence){next.dispose();return;}actor?.dispose();actor=next;entry=candidate;stage.scene.add(actor.root,actor.helper);
      const bounds=candidate.manifest.bounds;frameRoot.position.fromArray(bounds.min.map((v,i)=>(v+bounds.max[i])*.5));frameRoot.scale.fromArray(bounds.min.map((v,i)=>bounds.max[i]-v));frameRoot.updateMatrixWorld(true);
      for(const a of stage.actors())a.root.visible=false;stage.ground.visible=false;stage.marker.visible=false;stage.scene.background=new THREE.Color('#e9edef');
      $('[data-forge-animation]').replaceChildren(...candidate.manifest.animations.map(c=>new Option(c.name,c.name)));display();comparison('front');panel.dataset.ready='true';
      status(candidate.manifest.displayName+' · '+candidate.manifest.reconstructionMode+' · review-candidate（未承認）');
      const report=await fetch(candidate.reportUrl).then(r=>{if(!r.ok)throw new Error('Report HTTP '+r.status);return r.json();});if(token!==sequence)return;
      $('.forge-readout').textContent=JSON.stringify({provenance:candidate.manifest.provenance,performance:report.performance,comparisons:report.comparisons,warnings:report.warnings,limitations:report.limitations},null,2);
    }catch(error){if(token===sequence){panel.dataset.error=error.message;status(error.message);}}
  }
  for(const candidate of characterForgeCandidates){const b=document.createElement('button');b.type='button';b.dataset.forgeCandidate=candidate.manifest.id;const img=document.createElement('img');img.src=candidate.references.front;img.alt='';b.append(img,document.createTextNode(candidate.manifest.displayName));b.onclick=()=>select(candidate);$('.forge-candidates').append(b);}
  if(!characterForgeCandidates.length)status('生成候補はありません。Forge成功時に自動登録されます。');
  panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.forgeView)comparison(b.dataset.forgeView);if(b.hasAttribute('data-forge-bind')){actor?.neutral();comparison(selectedView);}if(b.hasAttribute('data-forge-pause')){paused=!paused;actor?.setPaused(paused);b.textContent=paused?'再生':'一時停止';}if(b.hasAttribute('data-forge-turntable')){turntable=!turntable;angle=0;if(turntable){stage.camera.fov=38;stage.camera.updateProjectionMatrix();positionReviewCamera({camera:stage.camera,controls:stage.orbit,root:actor.root,preset:'three-quarter'});}}if(b.hasAttribute('data-forge-exit')){deactivate();review.aim('front');}});
  $('[data-forge-animation]').onchange=e=>{actor?.play(e.target.value);paused=false;actor?.setPaused(false);};
  $('[data-forge-equipment]').onchange=e=>actor?.setEquipment({weapon:e.target.value||null});
  for(const selector of ['texture','wire','skeleton','sockets'])$('[data-forge-'+selector+']').onchange=display;
  $('[data-forge-overlay]').onchange=e=>$('.forge-comparison').dataset.overlay=String(e.target.checked);
  $('[data-forge-opacity]').oninput=e=>$('.forge-comparison').style.setProperty('--forge-opacity',e.target.value);
  const api={get active(){return Boolean(actor);},get actor(){return actor;},aim,deactivate,
    tick(dt){if(!actor)return;for(const a of stage.actors())a.root.visible=false;actor.update(dt);if(turntable){angle+=dt*.7;actor.root.rotation.y=angle;}stage.orbit.update();},
    snapshot:()=>actor?{...actor.snapshot(),view:selectedView,turntable,angle,subject:actor.cameraSubject()}:null,
    dispose(){deactivate();frameGeometry.dispose();frameMaterial.dispose();panel.remove();}};
  review.forge=api;stage.canvas.characterForgeSnapshot=api.snapshot;
  return api;
}
