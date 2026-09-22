import {kaykitModel} from '@soul/characters';
import {curatedAssetById,projectAssetUrl} from '@soul/assets';

const HEIGHT=1.7;
const MODES=new Map([['none','単体'],['both','Knight ＋ Rogue と比較'],['knight','Knight と比較'],['rogue','Rogue と比較']]);
const idleClip=clips=>clips.find(clip=>/^idle$/i.test(clip.name))||clips.find(clip=>/idle/i.test(clip.name));
const finite=values=>values.every(Number.isFinite);

/** Native-skeleton comparison inside the canonical object review stage. */
export function createCharacterComparison({THREE,loader,canvas,renderer,environment,dispose,refit,status}){
  const panel=document.createElement('fieldset');panel.id='character-comparison';panel.hidden=true;
  const legend=document.createElement('legend');legend.textContent='人物比較';
  const select=document.createElement('select');select.id='object-comparison';select.setAttribute('aria-label','比較キャラクター');
  select.replaceChildren(...Array.from(MODES,([id,label])=>new Option(label,id)));
  const initial=new URLSearchParams(location.search).get('compare');select.value=MODES.has(initial)?initial:'none';
  const info=document.createElement('p');info.id='character-comparison-info';info.style.cssText='font-size:.75rem;line-height:1.6;overflow-wrap:anywhere';
  panel.append(legend,select,info);document.querySelector('#object-options').before(panel);
  let subject=null,companions=[],revision=0,abort=null,lastFrame=0;
  const frameTimes=[];
  function stopCompanions(){
    for(const row of companions){row.mixer?.stopAllAction();row.mixer?.uncacheRoot(row.scene);dispose(row.wrapper);}
    companions=[];delete canvas.dataset.comparisonReady;
  }
  function detach(){revision++;abort?.abort();stopCompanions();subject=null;panel.hidden=true;}
  function wrap(scene){
    scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(scene,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(box.isEmpty()||!finite([...box.min,...box.max])||size.y<=0)throw new Error('人物の身長・足位置を計測できません');
    const wrapper=new THREE.Group(),scale=HEIGHT/size.y;wrapper.add(scene);wrapper.scale.setScalar(scale);
    wrapper.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    // An outer placement transform never overwrites authored animation tracks.
    const placement=new THREE.Group();placement.add(wrapper);
    return {wrapper:placement,normalizer:wrapper,authoredHeight:size.y,heightScale:scale,feetOffset:-box.min.y*scale};
  }
  async function loadKaykit(key,signal){
    const model=kaykitModel(key),filename=model.source.path.split('/').at(-1);
    const url=projectAssetUrl(`model/${model.source.gitBlobSha}/${filename}`,{environment});
    const response=await fetch(url,{signal,credentials:'omit',redirect:'error'});
    if(!response.ok)throw new Error(`比較モデルの取得に失敗 (${response.status}): ${model.label}`);
    const data=new Uint8Array(model.source.byteLength),reader=response.body?.getReader();let length=0;
    if(!reader)throw new Error('比較モデルのレスポンスが空です');
    try{for(;;){const {done,value}=await reader.read();if(done)break;if(length+value.length>data.length){await reader.cancel();throw new Error('比較モデルのサイズが一致しません');}data.set(value,length);length+=value.length;}}finally{reader.releaseLock();}
    if(length!==data.length)throw new Error('比較モデルのサイズが一致しません');
    const header=new TextEncoder().encode(`blob ${data.length}\0`),blob=new Uint8Array(header.length+data.length);blob.set(header);blob.set(data,header.length);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',blob)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==model.source.gitBlobSha)throw new Error('比較モデルの原本hashが一致しません');
    const gltf=await loader.parseAsync(data.buffer,'');
    if(signal.aborted){dispose(gltf.scene);throw signal.reason;}
    const clip=idleClip(gltf.animations);if(!clip){dispose(gltf.scene);throw new Error(`${model.label} にnative idleがありません`);}
    const framing=wrap(gltf.scene),mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(clip).play();
    return {...framing,id:model.id,label:model.label,scene:gltf.scene,mixer,clip:clip.name,url,sourceGitBlobSha:digest};
  }
  async function rebuild(){
    const token=++revision;abort?.abort();abort=new AbortController();const signal=abort.signal;
    stopCompanions();if(!subject)return;const current=subject;
    current.wrapper.position.x=0;panel.hidden=false;info.textContent='比較用の人物を読み込み中…';
    const keys=select.value==='both'?['knight','rogue']:select.value==='none'?[]:[select.value];
    const loaded=[];
    try{
      for(const key of keys){const row=await loadKaykit(key,signal);loaded.push(row);}
      if(token!==revision||subject!==current||signal.aborted){for(const row of loaded){row.mixer.stopAllAction();row.mixer.uncacheRoot(row.scene);dispose(row.wrapper);}return;}
      companions=loaded;
      const all=[current,...companions];all.forEach((row,index)=>{row.wrapper.position.x=(index-(all.length-1)/2)*1.3;current.outer.add(row.wrapper);});
      info.textContent=`${all.map(row=>row.label).join(' ／ ')}。同じ床・照明・カメラ、全身の高さを1.70に統一。比較用のみ・本編未採用。`;
      canvas.dataset.comparisonReady=select.value;canvas.dataset.characterModel=current.asset.modelId;refit();
    }catch(error){
      for(const row of loaded){row.mixer.stopAllAction();row.mixer.uncacheRoot(row.scene);dispose(row.wrapper);}
      if(token===revision&&!signal.aborted){info.textContent=error.message;throw error;}
    }
  }
  select.addEventListener('change',()=>{
    const url=new URL(location.href);url.searchParams.set('compare',select.value);history.replaceState(null,'',url);
    rebuild().catch(error=>status(error.message,true));
  });
  async function present(outer,item,gltf){
    if(!item.curatedAssetId||curatedAssetById(item.curatedAssetId).kind!=='character'){panel.hidden=true;return;}
    const asset=curatedAssetById(item.curatedAssetId),framing=wrap(gltf.scene);
    outer.add(framing.wrapper);subject={...framing,id:asset.modelId,label:asset.label,asset,scene:gltf.scene,outer};
    await rebuild();
  }
  function update(delta,now){
    for(const row of companions)row.mixer.update(delta);
    if(lastFrame&&now>lastFrame){frameTimes.push(now-lastFrame);if(frameTimes.length>90)frameTimes.shift();}lastFrame=now;
  }
  function snapshot(){
    const objects=subject?[subject,...companions].map(row=>{
      row.wrapper.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(row.wrapper,true),bones=[];
      row.scene.traverse(node=>{if(node.isBone)bones.push(...node.matrixWorld.elements);});
      return {id:row.id,label:row.label,authoredHeight:row.authoredHeight,heightScale:row.heightScale,feetOffset:row.feetOffset,
        position:row.wrapper.position.toArray(),bounds:{min:box.min.toArray(),max:box.max.toArray()},bones,
        clip:row.clip||canvas.dataset.nativeClip,url:row.url||projectAssetUrl(row.asset.runtimePath,{environment})};
    }):[];
    return {modelId:subject?.asset.modelId||null,comparison:canvas.dataset.comparisonReady||null,heightStandard:HEIGHT,objects,
      nativeClip:canvas.dataset.nativeClip,frameSamples:frameTimes.length,meanFrameMs:frameTimes.length?frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length:null,
      drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures};
  }
  canvas.characterReviewSnapshot=snapshot;
  return Object.freeze({present,detach,update,snapshot,destroy:()=>{detach();panel.remove();delete canvas.characterReviewSnapshot;}});
}
