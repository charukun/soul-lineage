import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EXPERIMENTAL_GENERATED_ASSETS} from '@soul/assets';
import {REVIEW_ROUTES} from './review-lab-config.js';

const ENDPOINT='https://stable-x-hi3dgen.hf.space';
const JOBS='/api/hi3dgen/jobs';
const STORED_JOB='visual-review-hi3dgen-job-v1';
const DEFAULTS=Object.freeze({seed:20260922,ssGuidanceStrength:3,ssSamplingSteps:30,slatGuidanceStrength:3,slatSamplingSteps:6});
const STEPS=Object.freeze(['queued','upload','submitted','inference','download','store','complete']);

const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node};
const slug=value=>String(value||'asset').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'asset';
const download=(name,blob)=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const jsonBlob=value=>new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function api(url,options){
  const response=await fetch(url,options);
  const type=response.headers.get('content-type')||'';
  if(!response.ok){let detail=`HTTP ${response.status}`;if(type.includes('json')){const body=await response.json().catch(()=>null);detail=body?.error||body?.message||detail}throw new Error(detail)}
  return type.includes('json')?response.json():response;
}
async function createJob(file,request){
  const form=new FormData();form.append('image',file,file.name||'input.png');form.append('request',JSON.stringify(request));
  return api(JOBS,{method:'POST',body:form});
}

function createPreview(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,100),controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;scene.add(new THREE.HemisphereLight(0xfff5db,0x33434c,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,7,5);scene.add(key);
  const loader=new GLTFLoader();let root=null,raf=0;
  const resize=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
  const frame=()=>{resize();controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(frame)};frame();
  return{
    async show(blob){
      if(root){scene.remove(root);root.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.()})}
      const data=await blob.arrayBuffer(),gltf=await loader.parseAsync(data,'');root=gltf.scene;scene.add(root);
      const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      root.position.sub(center);root.scale.setScalar(1.8/Math.max(size.x,size.y,size.z,.001));
      const nextSize=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      camera.position.set(2.5,Math.max(1.4,nextSize.y*.7),3.2);controls.target.set(0,0,0);controls.update();
    },
    destroy(){cancelAnimationFrame(raf);controls.dispose();renderer.dispose()}
  };
}

export function mountHi3dgenLab(){
  const host=document.querySelector('.lab-layout');if(!host)return;
  const section=el('section','lab-section hi3dgen-lab');
  section.innerHTML=`
    <div class="section-head"><div><span>ASSET FORGE</span><h2>画像 → 3D</h2></div><small>async Hi3DGen job</small></div>
    <div class="hi3dgen-grid">
      <div class="hi3dgen-input">
        <label class="hi3dgen-drop"><input type="file" accept="image/png,image/jpeg,image/webp"><span>画像を選ぶ</span><small>送信後はbackendで生成。画面を離れても継続</small><img alt="" hidden></label>
        <div class="hi3dgen-fields"><label>名前<input data-label value="生成アセット"></label><label>高さ(m)<input data-height type="number" min=".05" max="5" step=".05" value=".45"></label><label>上限tri<input data-tri type="number" min="100" max="20000" step="100" value="12000"></label></div>
        <div class="hi3dgen-actions"><button type="button" data-generate disabled>3D生成</button><button type="button" data-request disabled>request保存</button><button type="button" data-glb disabled>GLB保存</button></div>
        <div class="hi3dgen-progress" data-progress hidden><div class="hi3dgen-progress__track"><i></i></div><div class="hi3dgen-progress__steps">${STEPS.slice(0,-1).map(step=>`<span data-step="${step}"></span>`).join('')}</div></div>
        <output class="hi3dgen-status" data-status>画像を選択してください</output><small class="hi3dgen-job-id" data-job></small>
      </div>
      <div class="hi3dgen-preview"><canvas></canvas><div class="hi3dgen-result"><b data-result>未生成</b><span>生成結果はbackendに最大72時間保持。正式素材化は既存pipelineでprovenance付きGLBへ正規化します。</span></div></div>
    </div>
    <div class="hi3dgen-materialized"><div><b>素材化済み</b><span data-count></span></div><a data-open>RINNE 物体レビューで開く</a></div>`;
  host.after(section);
  const fileInput=section.querySelector('input[type=file]'),image=section.querySelector('img'),generate=section.querySelector('[data-generate]');
  const requestButton=section.querySelector('[data-request]'),glbButton=section.querySelector('[data-glb]'),status=section.querySelector('[data-status]');
  const result=section.querySelector('[data-result]'),labelInput=section.querySelector('[data-label]'),preview=createPreview(section.querySelector('canvas'));
  const progress=section.querySelector('[data-progress]'),bar=progress.querySelector('i'),jobText=section.querySelector('[data-job]');
  const open=section.querySelector('[data-open]');open.href=REVIEW_ROUTES.objects+'?generated=1';open.rel='noopener';
  section.querySelector('[data-count]').textContent=`${EXPERIMENTAL_GENERATED_ASSETS.length}件`;
  let file=null,lastBlob=null,lastRequest=null,pollToken=0,currentJob=null;
  const buildRequest=()=>({schema:1,id:`hi3dgen-${slug(labelInput.value)}-v1`,label:labelInput.value.trim()||'生成アセット',usage:'experimental-review',productionEligible:false,consentToPublicInference:true,images:[{path:`assets/generated/hi3dgen/inputs/${file?.name||'input.png'}`,view:'three-quarter',author:'Visual Review Lab operator',license:'LicenseRef-Operator-Supplied',source:'Visual Review Lab upload'}],provider:{id:'hi3dgen-hf',endpoint:ENDPOINT},parameters:{...DEFAULTS},postprocess:{heightMeters:Number(section.querySelector('[data-height]').value),yawDegrees:0,maxTriangles:Number(section.querySelector('[data-tri]').value)}});
  const setJobState=job=>{
    currentJob=job;progress.hidden=false;bar.style.width=`${Math.max(0,Math.min(100,job.progress||0))}%`;status.dataset.stage=job.status==='failed'?'error':job.status==='completed'?'complete':'running';status.textContent=job.message||job.stage||job.status;jobText.textContent=job.jobId?`job ${job.jobId.slice(0,8)}…`:'';
    for(const dot of progress.querySelectorAll('[data-step]'))dot.dataset.state=STEPS.indexOf(dot.dataset.step)<=STEPS.indexOf(job.stage)?'on':'off';
  };
  const finishJob=async job=>{
    const response=await api(job.result?.url||`${JOBS}/${job.jobId}/result`),blob=await response.blob();lastBlob=blob;await preview.show(blob);glbButton.disabled=false;
    result.textContent=`${lastRequest?.label||'生成アセット'} · ${(blob.size/1024/1024).toFixed(2)}MB`;localStorage.removeItem(STORED_JOB);
  };
  const watchJob=async jobId=>{
    const token=++pollToken;localStorage.setItem(STORED_JOB,jobId);generate.disabled=true;requestButton.disabled=true;glbButton.disabled=true;
    for(;;){
      if(token!==pollToken)return;
      try{
        const job=await api(`${JOBS}/${jobId}`);setJobState(job);
        if(job.status==='completed'){await finishJob(job);break}
        if(job.status==='failed'){localStorage.removeItem(STORED_JOB);break}
      }catch(error){status.dataset.stage='error';status.textContent=`状態取得に失敗: ${error.message}`}
      await sleep(document.hidden?5000:1800);
    }
    if(token===pollToken){generate.disabled=!file;requestButton.disabled=!file}
  };
  fileInput.addEventListener('change',()=>{file=fileInput.files?.[0]||null;lastBlob=null;glbButton.disabled=true;generate.disabled=!file||Boolean(currentJob&&currentJob.status==='running');requestButton.disabled=!file;
    if(file){image.src=URL.createObjectURL(file);image.hidden=false;status.dataset.stage='ready';status.textContent=`${file.name} · ${Math.ceil(file.size/1024)}KB`}else{image.hidden=true;status.dataset.stage='idle';status.textContent='画像を選択してください'}});
  requestButton.addEventListener('click',()=>{if(!file)return;lastRequest=buildRequest();download(lastRequest.id+'.request.json',jsonBlob(lastRequest))});
  glbButton.addEventListener('click',()=>{if(lastBlob)download((lastRequest?.id||currentJob?.jobId||'hi3dgen-result')+'.glb',lastBlob)});
  generate.addEventListener('click',async()=>{
    if(!file)return;lastRequest=buildRequest();generate.disabled=true;requestButton.disabled=true;progress.hidden=false;bar.style.width='2%';status.dataset.stage='running';status.textContent='非同期jobを作成中';
    try{const created=await createJob(file,lastRequest);await watchJob(created.jobId)}
    catch(error){console.error(error);status.dataset.stage='error';status.textContent=`job作成に失敗: ${error.message}`;generate.disabled=false;requestButton.disabled=false}
  });
  const stored=localStorage.getItem(STORED_JOB);if(stored){status.dataset.stage='running';status.textContent='前回jobへ再接続中';watchJob(stored)}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentJob?.jobId&&currentJob.status==='running')watchJob(currentJob.jobId)});
  addEventListener('pagehide',()=>{pollToken++;preview.destroy()},{once:true});
}
