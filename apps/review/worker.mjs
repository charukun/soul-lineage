const PROVIDER_ORIGIN='https://stable-x-hi3dgen.hf.space';
const REVIEW_JOB_PREFIX='/api/hi3dgen/jobs';
const MAX_INPUT_BYTES=8*1024*1024;
const MAX_RESULT_BYTES=32*1024*1024;
const CHUNK_BYTES=96*1024;
const JOB_TTL_MS=72*60*60*1000;
const LIMIT_WINDOW_MS=60*60*1000;
const LIMIT_PER_WINDOW=6;
const STAGE_PROGRESS=Object.freeze({queued:5,upload:18,submitted:32,inference:58,download:78,store:90,complete:100,failed:100});

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const nowIso=()=>new Date().toISOString();
const safeName=value=>String(value||'input.png').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)||'input.png';
const jobIdOk=value=>/^[a-f0-9-]{36}$/.test(String(value||''));
const sameOrigin=request=>{const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin};
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');

function validateRequest(request){
  if(!request||request.schema!==1||request.usage!=='experimental-review'||request.productionEligible!==false||request.consentToPublicInference!==true)throw new Error('invalid_request_contract');
  if(request.provider?.id!=='hi3dgen-hf'||request.provider?.endpoint!==PROVIDER_ORIGIN)throw new Error('invalid_provider');
  if(!Array.isArray(request.images)||request.images.length!==1)throw new Error('single_image_required');
  const p=request.parameters||{};
  for(const key of ['seed','ssSamplingSteps','slatSamplingSteps'])if(!Number.isInteger(p[key]))throw new Error('invalid_parameters');
  for(const key of ['ssGuidanceStrength','slatGuidanceStrength'])if(!Number.isFinite(p[key]))throw new Error('invalid_parameters');
  const post=request.postprocess||{};
  if(!Number.isFinite(post.heightMeters)||!Number.isInteger(post.maxTriangles))throw new Error('invalid_postprocess');
  return request;
}

async function writeChunks(storage,prefix,buffer){
  const bytes=buffer instanceof ArrayBuffer?buffer:await buffer.arrayBuffer();
  const count=Math.ceil(bytes.byteLength/CHUNK_BYTES);
  for(let index=0;index<count;index++)await storage.put(`${prefix}:${index}`,bytes.slice(index*CHUNK_BYTES,Math.min(bytes.byteLength,(index+1)*CHUNK_BYTES)));
  await storage.put(`${prefix}:meta`,{count,byteLength:bytes.byteLength});
  return {count,byteLength:bytes.byteLength};
}
async function readChunks(storage,prefix){
  const meta=await storage.get(`${prefix}:meta`);if(!meta)throw new Error('stored_payload_missing');
  const output=new Uint8Array(meta.byteLength);let offset=0;
  for(let index=0;index<meta.count;index++){const part=await storage.get(`${prefix}:${index}`);if(!(part instanceof ArrayBuffer))throw new Error('stored_chunk_missing');output.set(new Uint8Array(part),offset);offset+=part.byteLength}
  return output.buffer;
}
async function deleteChunks(storage,prefix){
  const meta=await storage.get(`${prefix}:meta`);if(meta){for(let index=0;index<meta.count;index++)await storage.delete(`${prefix}:${index}`)}
  await storage.delete(`${prefix}:meta`);
}
function glbHeader(bytes){
  if(bytes.byteLength<20)return false;
  const view=new DataView(bytes);
  return view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2&&view.getUint32(8,true)===bytes.byteLength;
}
function parseSse(text){
  let event='',complete=null;
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('event:'))event=line.slice(6).trim();
    if(line.startsWith('data:')){
      const payload=JSON.parse(line.slice(5));
      if(event==='error')throw new Error('provider_error');
      if(event==='complete'){complete=payload;break}
    }
  }
  if(!Array.isArray(complete)||!complete[2])throw new Error('provider_mesh_missing');
  return complete;
}
async function providerFetch(url,options={},timeout=120000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort('timeout'),timeout);
  try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
}

export class Hi3DGenRateLimit{
  constructor(state){this.state=state}
  async fetch(request){
    if(request.method!=='POST')return json({error:'method_not_allowed'},405);
    const now=Date.now(),row=await this.state.storage.get('limit')||{windowStart:now,count:0};
    const current=now-row.windowStart>=LIMIT_WINDOW_MS?{windowStart:now,count:0}:row;
    if(current.count>=LIMIT_PER_WINDOW)return json({error:'rate_limited',retryAfterMs:Math.max(0,current.windowStart+LIMIT_WINDOW_MS-now)},429);
    current.count+=1;await this.state.storage.put('limit',current);
    return json({ok:true,remaining:Math.max(0,LIMIT_PER_WINDOW-current.count)});
  }
}

export class Hi3DGenJob{
  constructor(state){this.state=state}
  async update(stage,message,extra={}){
    const previous=await this.state.storage.get('job')||{};
    const event={at:nowIso(),stage,message};
    const job={...previous,...extra,status:stage==='complete'?'completed':stage==='failed'?'failed':'running',stage,message,progress:STAGE_PROGRESS[stage]??previous.progress??0,updatedAt:event.at,events:[...(previous.events||[]),event].slice(-16)};
    await this.state.storage.put('job',job);return job;
  }
  async fail(error){
    const message=String(error?.message||error||'generation_failed').slice(0,500);
    const job=await this.update('failed',message,{error:message,expiresAt:Date.now()+JOB_TTL_MS});
    await this.state.storage.setAlarm(job.expiresAt);return job;
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/internal/init'&&request.method==='POST'){
      if(await this.state.storage.get('job'))return json({error:'job_exists'},409);
      const form=await request.formData(),image=form.get('image'),requestText=form.get('request'),jobId=request.headers.get('x-hi3dgen-job-id');
      if(!jobIdOk(jobId)||!(image instanceof Blob)||typeof requestText!=='string')return json({error:'invalid_job_input'},400);
      if(image.size<=0||image.size>MAX_INPUT_BYTES||!['image/png','image/jpeg','image/webp'].includes(image.type))return json({error:'invalid_image'},400);
      let parsed;try{parsed=validateRequest(JSON.parse(requestText))}catch(error){return json({error:String(error.message||error)},400)}
      const input=await image.arrayBuffer();await writeChunks(this.state.storage,'input',input);
      const createdAt=nowIso(),job={jobId,status:'queued',stage:'queued',message:'生成待ち',progress:STAGE_PROGRESS.queued,createdAt,updatedAt:createdAt,input:{name:safeName(image.name),type:image.type,byteLength:image.size,sha256:await sha256(input)},request:parsed,events:[{at:createdAt,stage:'queued',message:'生成待ち'}]};
      await this.state.storage.put('job',job);await this.state.storage.setAlarm(Date.now()+1);
      return json({jobId,status:'queued',stage:'queued',progress:job.progress},202);
    }
    if(url.pathname==='/internal/status'&&request.method==='GET'){
      const job=await this.state.storage.get('job');return job?json(job):json({error:'job_not_found'},404);
    }
    if(url.pathname==='/internal/result'&&request.method==='GET'){
      const job=await this.state.storage.get('job');if(!job)return json({error:'job_not_found'},404);
      if(job.status!=='completed')return json({error:'result_not_ready',status:job.status},409);
      const bytes=await readChunks(this.state.storage,'result');
      return new Response(bytes,{headers:{'content-type':'model/gltf-binary','content-length':String(bytes.byteLength),'cache-control':'private, max-age=300','content-disposition':`attachment; filename="${job.jobId}.glb"`}});
    }
    return json({error:'not_found'},404);
  }
  async alarm(){
    const job=await this.state.storage.get('job');if(!job)return;
    if(['completed','failed'].includes(job.status)){
      if(job.expiresAt&&Date.now()>=job.expiresAt)await this.state.storage.deleteAll();
      else if(job.expiresAt)await this.state.storage.setAlarm(job.expiresAt);
      return;
    }
    try{
      const input=await readChunks(this.state.storage,'input');
      await this.update('upload','画像をbackendから送信中');
      const form=new FormData();form.append('files',new File([input],job.input.name,{type:job.input.type}),job.input.name);
      const upload=await providerFetch(PROVIDER_ORIGIN+'/gradio_api/upload',{method:'POST',body:form});
      if(!upload.ok)throw new Error(`provider_upload_${upload.status}`);
      const files=await upload.json();if(!Array.isArray(files)||typeof files[0]!=='string')throw new Error('provider_upload_invalid');
      const p=job.request.parameters,imageData={path:files[0],orig_name:job.input.name,meta:{_type:'gradio.FileData'}};
      await this.update('submitted','Hi3DGenへ生成依頼中');
      const submitted=await providerFetch(PROVIDER_ORIGIN+'/gradio_api/call/generate_3d',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:[imageData,p.seed,p.ssGuidanceStrength,p.ssSamplingSteps,p.slatGuidanceStrength,p.slatSamplingSteps]})});
      if(!submitted.ok)throw new Error(`provider_submit_${submitted.status}`);
      const submitJson=await submitted.json(),eventId=submitJson.event_id;if(!/^[a-zA-Z0-9_-]{1,100}$/.test(eventId||''))throw new Error('provider_event_invalid');
      await this.update('inference','3D生成中',{eventId});
      const stream=await providerFetch(PROVIDER_ORIGIN+'/gradio_api/call/generate_3d/'+encodeURIComponent(eventId),{},720000);
      if(!stream.ok)throw new Error(`provider_stream_${stream.status}`);
      const result=parseSse(await stream.text()),mesh=typeof result[2]==='string'?{path:result[2]}:result[2];
      const remote=new URL(mesh.url||PROVIDER_ORIGIN+'/gradio_api/file='+encodeURI(mesh.path));
      if(remote.origin!==PROVIDER_ORIGIN)throw new Error('provider_result_origin');
      await this.update('download','生成GLBを取得中',{eventId});
      const output=await providerFetch(remote.href,{},180000);if(!output.ok)throw new Error(`provider_result_${output.status}`);
      const bytes=await output.arrayBuffer();if(bytes.byteLength<=20||bytes.byteLength>MAX_RESULT_BYTES||!glbHeader(bytes))throw new Error('invalid_glb_result');
      await this.update('store','結果をbackendへ保存中',{eventId});
      await deleteChunks(this.state.storage,'result');await writeChunks(this.state.storage,'result',bytes);
      const expiresAt=Date.now()+JOB_TTL_MS,digest=await sha256(bytes);
      await deleteChunks(this.state.storage,'input');
      await this.update('complete','生成完了',{eventId,expiresAt,result:{byteLength:bytes.byteLength,sha256:digest,url:`${REVIEW_JOB_PREFIX}/${job.jobId}/result`}});
      await this.state.storage.setAlarm(expiresAt);
    }catch(error){await this.fail(error)}
  }
}

function jobStub(env,jobId){return env.HI3DGEN_JOBS.get(env.HI3DGEN_JOBS.idFromName(jobId))}
function limiterStub(env,ip){return env.HI3DGEN_LIMITS.get(env.HI3DGEN_LIMITS.idFromName(ip||'unknown'))}
function publicStatus(job){
  const {request,input,...rest}=job;
  return {...rest,input:input?{name:input.name,type:input.type,byteLength:input.byteLength,sha256:input.sha256}:null};
}

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname===REVIEW_JOB_PREFIX&&request.method==='POST'){
      if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
      const length=Number(request.headers.get('content-length')||0);if(length>MAX_INPUT_BYTES+256*1024)return json({error:'payload_too_large'},413);
      const ip=request.headers.get('cf-connecting-ip')||'unknown';
      const limit=await limiterStub(env,ip).fetch(new Request('https://internal/take',{method:'POST'}));if(!limit.ok)return limit;
      const form=await request.formData(),jobId=crypto.randomUUID(),stub=jobStub(env,jobId);
      const initialized=await stub.fetch(new Request('https://internal/internal/init',{method:'POST',body:form,headers:{'x-hi3dgen-job-id':jobId}}));
      if(!initialized.ok)return initialized;
      const body=await initialized.json();return json({...body,statusUrl:`${REVIEW_JOB_PREFIX}/${jobId}`,resultUrl:`${REVIEW_JOB_PREFIX}/${jobId}/result`},202);
    }
    if(url.pathname.startsWith(REVIEW_JOB_PREFIX+'/')){
      const suffix=url.pathname.slice(REVIEW_JOB_PREFIX.length+1),parts=suffix.split('/'),jobId=parts[0];
      if(!jobIdOk(jobId))return json({error:'invalid_job_id'},400);
      const stub=jobStub(env,jobId);
      if(parts.length===1&&request.method==='GET'){
        const response=await stub.fetch(new Request('https://internal/internal/status'));if(!response.ok)return response;
        return json(publicStatus(await response.json()));
      }
      if(parts.length===2&&parts[1]==='result'&&request.method==='GET')return stub.fetch(new Request('https://internal/internal/result'));
      return json({error:'not_found'},404);
    }
    if(url.pathname.startsWith('/api/'))return json({error:'not_found'},404);
    return env.ASSETS.fetch(request);
  }
};
