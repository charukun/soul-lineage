import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EXPERIMENTAL_GENERATED_ASSETS} from '@soul/assets';
import {REVIEW_ROUTES} from './review-lab-config.js';

const ENDPOINT='https://stable-x-hi3dgen.hf.space';
const DEFAULTS=Object.freeze({seed:20260922,ssGuidanceStrength:3,ssSamplingSteps:30,slatGuidanceStrength:3,slatSamplingSteps:6});

const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node};
const slug=value=>String(value||'asset').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'asset';
const download=(name,blob)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const jsonBlob=value=>new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});

async function readSse(response){
  if(!response.ok)throw new Error(`生成待機に失敗しました (${response.status})`);
  const reader=response.body?.getReader();if(!reader)throw new Error('生成ストリームを読み取れません');
  const decoder=new TextDecoder();let buffer='',event='',result=null;
  for(;;){
    const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
    const lines=buffer.split(/\r?\n/);buffer=lines.pop()||'';
    for(const line of lines){
      if(line.startsWith('event:'))event=line.slice(6).trim();
      if(line.startsWith('data:')){
        const payload=JSON.parse(line.slice(5));
        if(event==='error')throw new Error('Hi3DGen側で生成に失敗しました');
        if(event==='complete'){result=payload;break}
      }
    }
    if(result||done)break;
  }
  if(!Array.isArray(result)||!result[2])throw new Error('3D meshが返されませんでした');
  return result;
}

async function generateGlb(file,onStage){
  onStage('upload','画像を送信中');
  const upload=new FormData();upload.append('files',file,file.name||'input.png');
  const uploaded=await fetch(ENDPOINT+'/gradio_api/upload',{method:'POST',body:upload});
  if(!uploaded.ok)throw new Error(`画像送信に失敗しました (${uploaded.status})`);
  const files=await uploaded.json();
  if(!Array.isArray(files)||!files[0])throw new Error('画像送信結果が不正です');
  const imageData={path:files[0],orig_name:file.name||'input.png',meta:{_type:'gradio.FileData'}};
  onStage('inference','3Dを生成中');
  const submitted=await fetch(ENDPOINT+'/gradio_api/call/generate_3d',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({data:[imageData,DEFAULTS.seed,DEFAULTS.ssGuidanceStrength,DEFAULTS.ssSamplingSteps,DEFAULTS.slatGuidanceStrength,DEFAULTS.slatSamplingSteps]}),
  });
  if(!submitted.ok)throw new Error(`生成開始に失敗しました (${submitted.status})`);
  const {event_id:eventId}=await submitted.json();if(!eventId)throw new Error('生成IDを取得できません');
  const result=await readSse(await fetch(ENDPOINT+'/gradio_api/call/generate_3d/'+encodeURIComponent(eventId)));
  const mesh=typeof result[2]==='string'?{path:result[2]}:result[2];
  const remote=mesh.url||ENDPOINT+'/gradio_api/file='+encodeURI(mesh.path);
  if(!remote.startsWith(ENDPOINT+'/'))throw new Error('想定外の配信元が返されました');
  onStage('download','GLBを取得中');
  const response=await fetch(remote);if(!response.ok)throw new Error(`GLB取得に失敗しました (${response.status})`);
  const blob=await response.blob();
  if(blob.size<20||blob.size>128*1024*1024)throw new Error('GLBサイズが許容範囲外です');
  return {blob,eventId};
}

function createPreview(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,1,.01,100);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
  scene.add(new THREE.HemisphereLight(0xfff5db,0x33434c,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,7,5);scene.add(key);
  const loader=new GLTFLoader();let root=null,raf=0;
  const resize=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
  const frame=()=>{resize();controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(frame)};frame();
  return{
    async show(blob){
      if(root){scene.remove(root);root.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()})}
      const data=await blob.arrayBuffer();const gltf=await loader.parseAsync(data,'');root=gltf.scene;scene.add(root);
      const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      root.position.sub(center);const longest=Math.max(size.x,size.y,size.z,.001);root.scale.setScalar(1.8/longest);
      const nextBox=new THREE.Box3().setFromObject(root),nextSize=nextBox.getSize(new THREE.Vector3());
      camera.position.set(2.5,Math.max(1.4,nextSize.y*.7),3.2);controls.target.set(0,0,0);controls.update();
    },
    destroy(){cancelAnimationFrame(raf);controls.dispose();renderer.dispose()}
  };
}

export function mountHi3dgenLab(){
  const host=document.querySelector('.lab-layout');if(!host)return;
  const section=el('section','lab-section hi3dgen-lab');
  section.innerHTML=`
    <div class="section-head"><div><span>ASSET FORGE</span><h2>画像 → 3D</h2></div><small>accountless Hi3DGen preview</small></div>
    <div class="hi3dgen-grid">
      <div class="hi3dgen-input">
        <label class="hi3dgen-drop"><input type="file" accept="image/png,image/jpeg,image/webp"><span>画像を選ぶ</span><small>PNG / JPEG / WebP · 外部公開推論へ送信</small><img alt="" hidden></label>
        <div class="hi3dgen-fields"><label>名前<input data-label value="生成アセット"></label><label>高さ(m)<input data-height type="number" min=".05" max="5" step=".05" value=".45"></label><label>上限tri<input data-tri type="number" min="100" max="20000" step="100" value="12000"></label></div>
        <div class="hi3dgen-actions"><button type="button" data-generate disabled>3D生成</button><button type="button" data-request disabled>request保存</button><button type="button" data-glb disabled>GLB保存</button></div>
        <output class="hi3dgen-status" data-status>画像を選択してください</output>
      </div>
      <div class="hi3dgen-preview"><canvas></canvas><div class="hi3dgen-result"><b data-result>未生成</b><span>生成結果はまずプレビュー。正式素材化は既存pipelineでprovenance付きGLBへ正規化します。</span></div></div>
    </div>
    <div class="hi3dgen-materialized"><div><b>素材化済み</b><span data-count></span></div><a data-open>RINNE 物体レビューで開く</a></div>`;
  host.after(section);
  const fileInput=section.querySelector('input[type=file]'),image=section.querySelector('img'),generate=section.querySelector('[data-generate]');
  const requestButton=section.querySelector('[data-request]'),glbButton=section.querySelector('[data-glb]'),status=section.querySelector('[data-status]');
  const result=section.querySelector('[data-result]'),labelInput=section.querySelector('[data-label]'),preview=createPreview(section.querySelector('canvas'));
  const open=section.querySelector('[data-open]');open.href=REVIEW_ROUTES.objects+'?generated=1';open.rel='noopener';
  section.querySelector('[data-count]').textContent=`${EXPERIMENTAL_GENERATED_ASSETS.length}件`;
  let file=null,lastBlob=null,lastRequest=null;
  const setStage=(stage,message)=>{status.dataset.stage=stage;status.textContent=message};
  const buildRequest=()=>({
    schema:1,id:`hi3dgen-${slug(labelInput.value)}-v1`,label:labelInput.value.trim()||'生成アセット',usage:'experimental-review',
    productionEligible:false,consentToPublicInference:true,
    images:[{path:`assets/generated/hi3dgen/inputs/${file?.name||'input.png'}`,view:'three-quarter',author:'Visual Review Lab operator',license:'LicenseRef-Operator-Supplied',source:'Visual Review Lab local upload'}],
    provider:{id:'hi3dgen-hf',endpoint:ENDPOINT},parameters:{...DEFAULTS},
    postprocess:{heightMeters:Number(section.querySelector('[data-height]').value),yawDegrees:0,maxTriangles:Number(section.querySelector('[data-tri]').value)}
  });
  fileInput.addEventListener('change',()=>{file=fileInput.files?.[0]||null;lastBlob=null;glbButton.disabled=true;generate.disabled=!file;requestButton.disabled=!file;
    if(file){image.src=URL.createObjectURL(file);image.hidden=false;setStage('ready',`${file.name} · ${Math.ceil(file.size/1024)}KB`)}else{image.hidden=true;setStage('idle','画像を選択してください')}});
  requestButton.addEventListener('click',()=>{if(!file)return;lastRequest=buildRequest();download(lastRequest.id+'.request.json',jsonBlob(lastRequest))});
  glbButton.addEventListener('click',()=>{if(lastBlob)download((lastRequest?.id||'hi3dgen-preview')+'.glb',lastBlob)});
  generate.addEventListener('click',async()=>{
    if(!file)return;generate.disabled=true;requestButton.disabled=true;glbButton.disabled=true;lastRequest=buildRequest();
    try{const generated=await generateGlb(file,setStage);lastBlob=generated.blob;await preview.show(lastBlob);result.textContent=`${lastRequest.label} · ${(lastBlob.size/1024/1024).toFixed(2)}MB`;setStage('complete','生成完了。回転して確認できます');glbButton.disabled=false}
    catch(error){console.error(error);setStage('error',error?.message||'生成に失敗しました')}
    finally{generate.disabled=false;requestButton.disabled=false}
  });
  addEventListener('pagehide',()=>preview.destroy(),{once:true});
}
