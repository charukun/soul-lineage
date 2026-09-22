import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './hybrid-25d-lab.css';
import {createSprite25dActor} from '@soul/assets/sprite25d/three';
import {createCharacter25DActor} from '@soul/assets/character25d/three';
import {createCharacter25DPlayground} from './character25d-playground.js';

const MODEL_URL='./library/model/3ced3b11942d57cd82763715c7196dfd4f53141e/HeroineDawn.glb';
const VIEW_PRESETS=Object.freeze({
  front:0,
  quarter:Math.PI*.25,
  side:Math.PI*.5,
  back:Math.PI,
});

const el=(tag,className='',text='')=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text)node.textContent=text;
  return node;
};

function placeholderTexture(){
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=768;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const glow=ctx.createRadialGradient(256,260,20,256,280,250);
  glow.addColorStop(0,'rgba(227,203,142,.3)');glow.addColorStop(1,'rgba(227,203,142,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,512,768);
  ctx.fillStyle='#b8a06b';ctx.beginPath();ctx.arc(256,190,90,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#88744d';ctx.beginPath();ctx.moveTo(155,640);ctx.quadraticCurveTo(165,340,256,320);ctx.quadraticCurveTo(347,340,357,640);ctx.closePath();ctx.fill();
  ctx.fillStyle='#dacb9a';ctx.font='700 28px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText('2.5D IMAGE',256,704);
  ctx.fillStyle='#9b8a62';ctx.font='500 18px system-ui,sans-serif';ctx.fillText('画像を選ぶとここに表示',256,736);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function createGroundTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#39413c';ctx.fillRect(0,0,512,512);
  const size=64;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const inset=4;const ox=x*size+(y%2?size*.22:0);
    ctx.fillStyle=((x+y)%3===0)?'#454c46':((x+y)%3===1)?'#3f4741':'#4a514a';
    ctx.fillRect((ox+inset)%512,y*size+inset,size-inset*2,size-inset*2);
  }
  ctx.strokeStyle='rgba(18,24,21,.52)';ctx.lineWidth=3;
  for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(0,i*size);ctx.lineTo(512,i*size);ctx.stroke()}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,5);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function disposeMaterial(material){
  if(!material)return;
  const materials=Array.isArray(material)?material:[material];
  for(const item of materials){
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap'])item[key]?.dispose?.();
    item.dispose?.();
  }
}

function createHybridPreview(canvas,onStatus){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x111917,1);

  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x111917,7,15);
  const camera=new THREE.PerspectiveCamera(38,1,.05,40);camera.position.set(4.5,2.8,5.8);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.target.set(0,.85,0);controls.minDistance=2.6;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.48;

  scene.add(new THREE.HemisphereLight(0xdbe9df,0x28302c,1.9));
  const key=new THREE.DirectionalLight(0xffedcf,3.2);key.position.set(-3,6,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.DirectionalLight(0xaec8df,1.1);rim.position.set(5,3,-4);scene.add(rim);

  const groundTexture=createGroundTexture();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.MeshStandardMaterial({map:groundTexture,color:0xb9c0ba,roughness:.96,metalness:0}));
  ground.rotation.x=-Math.PI*.5;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(12,24,0x58635d,0x444d48);grid.position.y=.007;grid.material.opacity=.18;grid.material.transparent=true;scene.add(grid);

  const cardGroup=new THREE.Group();cardGroup.position.set(1.2,0,0);scene.add(cardGroup);
  const cardMaterial=new THREE.MeshBasicMaterial({map:placeholderTexture(),transparent:true,alphaTest:.035,side:THREE.DoubleSide,toneMapped:false});
  const card=new THREE.Mesh(new THREE.PlaneGeometry(1,1),cardMaterial);card.position.y=.88;card.renderOrder=2;cardGroup.add(card);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.42,48),new THREE.MeshBasicMaterial({color:0x050706,transparent:true,opacity:.42,depthWrite:false}));
  shadow.rotation.x=-Math.PI*.5;shadow.scale.set(1.15,.58,1);shadow.position.y=.012;cardGroup.add(shadow);
  const proxy=new THREE.Mesh(new THREE.CapsuleGeometry(.24,1.06,8,14),new THREE.MeshBasicMaterial({color:0xcdb675,wireframe:true,transparent:true,opacity:.45,depthTest:false}));
  proxy.position.y=.77;proxy.visible=false;proxy.renderOrder=3;cardGroup.add(proxy);

  const modelGroup=new THREE.Group();modelGroup.position.set(-1.2,0,0);scene.add(modelGroup);
  const loader=new GLTFLoader();let modelRoot=null,mixer=null,modelReady=false;
  let spriteActor=null,destroyed=false,imageRevision=0;
  const playground=createCharacter25DPlayground({THREE,scene,camera,canvas,getActor:()=>spriteActor});
  canvas.character25dSnapshot=()=>spriteActor?.snapshot?.()||null;
  loader.load(new URL(MODEL_URL,location.href).href,gltf=>{
    if(destroyed){gltf.scene.traverse(node=>{node.geometry?.dispose?.();disposeMaterial(node.material)});return;}
    modelRoot=gltf.scene;modelGroup.add(modelRoot);
    modelRoot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true}});
    const box=new THREE.Box3().setFromObject(modelRoot),size=box.getSize(new THREE.Vector3());
    const scale=1.72/Math.max(size.y,.001);modelRoot.scale.setScalar(scale);
    const scaledBox=new THREE.Box3().setFromObject(modelRoot);modelRoot.position.y-=scaledBox.min.y;
    const centered=new THREE.Box3().setFromObject(modelRoot),center=centered.getCenter(new THREE.Vector3());modelRoot.position.x-=center.x;modelRoot.position.z-=center.z;
    if(gltf.animations?.length){
      mixer=new THREE.AnimationMixer(modelRoot);
      const clip=gltf.animations.find(item=>/idle/i.test(item.name))||gltf.animations[0];mixer.clipAction(clip).play();
    }
    modelReady=true;onStatus('ready','3Dモデル読込済み · 2D画像を選ぶと同一空間で比較できます');
  },undefined,error=>{console.error(error);onStatus('error','3Dモデルを読み込めませんでした。2.5D側だけでも操作できます')});

  let billboard=true,idleMotion=true,arrangement='split';let raf=0;const clock=new THREE.Clock();
  const resize=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
  const fitCard=texture=>{
    const image=texture.image;const ratio=Math.max(.25,Math.min(4,(image?.width||2)/(image?.height||3)));const height=1.72;card.scale.set(height*ratio,height,1);card.position.y=height*.5;
  };
  fitCard(cardMaterial.map);

  const frame=()=>{
    resize();const delta=Math.min(clock.getDelta(),.05);mixer?.update(delta);
    const t=performance.now()*.001;
    card.position.y=(card.scale.y*.5)+(idleMotion?Math.sin(t*2.2)*.018:0);
    if(billboard){const dx=camera.position.x-cardGroup.position.x,dz=camera.position.z-cardGroup.position.z;cardGroup.rotation.y=Math.atan2(dx,dz)}else cardGroup.rotation.y=0;
    controls.update();
    if(spriteActor){if(spriteActor.proxy){playground.update(delta);}else spriteActor.object.position.copy(cardGroup.position);spriteActor.update({camera,delta,billboard});}
    renderer.render(scene,camera);raf=requestAnimationFrame(frame);
  };frame();

  return{
    async setCharacter(bundle){
      const revision=++imageRevision,next=await (bundle.schema==='rinne.character25d/v2'?createCharacter25DActor(THREE,bundle,{canMoveTo:playground.canMoveTo,sampleGround:playground.sampleGround}):createSprite25dActor(THREE,bundle));
      if(destroyed||revision!==imageRevision){next.dispose();return;}
      spriteActor?.dispose();spriteActor=next;scene.add(next.object);card.visible=false;shadow.visible=false;next.setTransform?.({x:cardGroup.position.x,y:0,z:cardGroup.position.z},0);next.setOpacity(arrangement==='overlay'?.74:1);playground.activate();
    },
    clearCharacter(){imageRevision++;spriteActor?.dispose();spriteActor=null;card.visible=true;shadow.visible=true;},
    setSpritePreview(action,direction){spriteActor?.setPreview(action,direction);},
    async setImage(file){
      const revision=++imageRevision,url=URL.createObjectURL(file);
      try{
        const texture=await new THREE.TextureLoader().loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;
        if(destroyed||revision!==imageRevision){texture.dispose();return;}
        spriteActor?.dispose();spriteActor=null;card.visible=true;
        const previous=cardMaterial.map;cardMaterial.map=texture;cardMaterial.needsUpdate=true;fitCard(texture);previous?.dispose?.();
      }finally{URL.revokeObjectURL(url)}
    },
    setBillboard(value){billboard=Boolean(value)},
    setProxy(value){proxy.visible=Boolean(value)&&!spriteActor?.proxy;spriteActor?.setDebug?.(value)},
    setIdle(value){idleMotion=Boolean(value)},
    setArrangement(value){
      arrangement=value==='overlay'?'overlay':'split';
      if(arrangement==='overlay'){modelGroup.position.set(-.12,0,-.12);cardGroup.position.set(.12,0,.12);cardMaterial.opacity=.74}
      else{modelGroup.position.set(-1.2,0,0);cardGroup.position.set(1.2,0,0);cardMaterial.opacity=1}
      cardMaterial.transparent=true;spriteActor?.setOpacity(cardMaterial.opacity);spriteActor?.setTransform?.({x:cardGroup.position.x,y:0,z:cardGroup.position.z},0);
    },
    setView(name){
      // A preset cancels residual drag momentum before setting the camera.
      const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
      const angle=VIEW_PRESETS[name]??VIEW_PRESETS.quarter;const radius=5.7;camera.position.set(Math.sin(angle)*radius,2.55,Math.cos(angle)*radius);controls.target.set(0,.85,0);controls.update();controls.enableDamping=damping;
    },
    getState(){return{modelReady,billboard,idleMotion,arrangement,spriteStatus:spriteActor?.getStatus()||null,actor:spriteActor?.snapshot?.()||null}},
    destroy(){if(destroyed)return;destroyed=true;imageRevision++;playground.dispose();delete canvas.character25dSnapshot;spriteActor?.dispose();cancelAnimationFrame(raf);controls.dispose();renderer.dispose();groundTexture.dispose();ground.geometry.dispose();disposeMaterial(ground.material);grid.geometry.dispose();disposeMaterial(grid.material);card.geometry.dispose();disposeMaterial(card.material);shadow.geometry.dispose();disposeMaterial(shadow.material);proxy.geometry.dispose();disposeMaterial(proxy.material);if(modelRoot)modelRoot.traverse(node=>{node.geometry?.dispose?.();disposeMaterial(node.material)})}
  };
}

export function mountHybrid25dLab(){
  const anchor=document.querySelector('.hi3dgen-lab')||document.querySelector('.lab-layout');if(!anchor)return;
  const section=el('section','lab-section hybrid25d-lab');
  section.innerHTML=`
    <div class="section-head"><div><span>CHARACTER PLAYGROUND</span><h2>2.5D × 3D 共存ビュー</h2></div><small>same world · same camera · same scale</small></div>
    <div class="hybrid25d-grid">
      <div class="hybrid25d-controls">
        <details class="character25d-legacy-render"><summary>従来表示の詳細</summary><label class="hybrid25d-upload"><input type="file" accept="image/png,image/jpeg,image/webp"><b>2Dキャラ画像を選ぶ</b><span>透過PNG推奨。端末内の絵をそのまま3D空間へ置きます。</span></label>
        <div class="hybrid25d-switches">
          <label><input type="checkbox" data-billboard checked><span>カメラ追従</span></label>
          <label><input type="checkbox" data-idle checked><span>微動（単一画像）</span></label>
          <label><input type="checkbox" data-proxy><span>3D proxy表示</span></label>
        </div>
        </details><div class="hybrid25d-arrange"><button type="button" data-arrange="split" aria-pressed="true">並べる</button><button type="button" data-arrange="overlay" aria-pressed="false">重ね比較</button></div>
        <div class="hybrid25d-views" aria-label="camera presets"><button type="button" data-view="front">正面</button><button type="button" data-view="quarter">斜め</button><button type="button" data-view="side">横</button><button type="button" data-view="back">背面</button></div>
        <output class="hybrid25d-status" data-status data-stage="loading">3Dモデルを読み込み中</output>
        <p class="hybrid25d-note">左が既存3D、右が2.5D。地面・カメラ・照明・接地影を共有し、混在した時の違和感を先に見ます。</p>
      </div>
      <div class="hybrid25d-stage"><canvas></canvas><div class="hybrid25d-badges"><span>3D</span><span>2.5D</span></div></div>
    </div>`;
  anchor.after(section);
  const status=section.querySelector('[data-status]');
  const setStatus=(stage,message)=>{status.dataset.stage=stage;status.textContent=message};
  const preview=createHybridPreview(section.querySelector('canvas'),setStatus);
  const fileInput=section.querySelector('input[type=file]');
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    setStatus('loading',`${file.name} を2.5D面へ配置中`);
    try{await preview.setImage(file);setStatus('ready',`${file.name} · 2.5D表示中。カメラを回して共存感を確認できます`)}
    catch(error){console.error(error);setStatus('error','画像を読み込めませんでした')}
  });
  section.querySelector('[data-billboard]').addEventListener('change',event=>preview.setBillboard(event.currentTarget.checked));
  section.querySelector('[data-idle]').addEventListener('change',event=>preview.setIdle(event.currentTarget.checked));
  section.querySelector('[data-proxy]').addEventListener('change',event=>preview.setProxy(event.currentTarget.checked));
  for(const button of section.querySelectorAll('[data-arrange]'))button.addEventListener('click',()=>{
    const mode=button.dataset.arrange;preview.setArrangement(mode);
    for(const item of section.querySelectorAll('[data-arrange]'))item.setAttribute('aria-pressed',String(item===button));
  });
  for(const button of section.querySelectorAll('[data-view]'))button.addEventListener('click',()=>preview.setView(button.dataset.view));
  preview.setView('quarter');
  addEventListener('pagehide',()=>preview.destroy(),{once:true});
  return {section,preview};
}
