import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry
} from 'three';

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const smooth=value=>{const t=clamp01(value);return t*t*(3-2*t);};

export const MANIFESTATION_STAGES=Object.freeze({
  DORMANT:'dormant',
  HINTED:'hinted',
  LOADING:'loading',
  FORMING:'forming',
  MANIFESTED:'manifested',
  FAILED:'failed'
});

const profile=(id,{duration=.42,color=0xd9ecff,energy=.5,particles=.55,shock=.18,distortion=.08,scaleFrom=.82}={})=>Object.freeze({id,duration,color,energy,particles,shock,distortion,scaleFrom});
export const MANIFESTATION_PROFILES=Object.freeze({
  subtle:profile('subtle',{duration:.24,color:0xcbd8e6,energy:.22,particles:.22,shock:.03,distortion:.02,scaleFrom:.96}),
  human:profile('human',{duration:.4,color:0xd8edff,energy:.48,particles:.46,shock:.1,distortion:.05,scaleFrom:.9}),
  hostile:profile('hostile',{duration:.34,color:0xff6e8c,energy:.82,particles:.7,shock:.42,distortion:.16,scaleFrom:.78}),
  massive:profile('massive',{duration:.72,color:0xffc36d,energy:.92,particles:.58,shock:.88,distortion:.14,scaleFrom:.7}),
  shadow:profile('shadow',{duration:.56,color:0x9b79d8,energy:.78,particles:.74,shock:.18,distortion:.42,scaleFrom:.76}),
  swarm:profile('swarm',{duration:.46,color:0xa2e8ff,energy:.65,particles:1,shock:.14,distortion:.2,scaleFrom:.86})
});

export function manifestationProfileFor(input='subtle'){
  if(input&&typeof input==='object'&&typeof input.id==='string')return Object.freeze({...MANIFESTATION_PROFILES.subtle,...input});
  return MANIFESTATION_PROFILES[input]||MANIFESTATION_PROFILES.subtle;
}

export function manifestationVisualPhase(stage,progress=0,{profile='subtle',qualityScale=1}={}){
  const p=manifestationProfileFor(profile),q=Math.max(.2,Math.min(1,Number(qualityScale)||1)),t=clamp01(progress);
  if(stage===MANIFESTATION_STAGES.MANIFESTED)return Object.freeze({stage,progress:1,silhouette:0,detail:1,effect:0,shock:0,particles:0,scale:1,profile:p.id});
  if(stage===MANIFESTATION_STAGES.FAILED)return Object.freeze({stage,progress:t,silhouette:1,detail:0,effect:0,shock:0,particles:0,scale:1,profile:p.id});
  if(stage===MANIFESTATION_STAGES.FORMING){const e=1-smooth(t);return Object.freeze({stage,progress:t,silhouette:e,detail:smooth(t),effect:e*p.energy*q,shock:Math.sin(Math.PI*t)*p.shock*q,particles:e*p.particles*q,scale:p.scaleFrom+(1-p.scaleFrom)*smooth(t),profile:p.id});}
  if(stage===MANIFESTATION_STAGES.LOADING)return Object.freeze({stage,progress:t,silhouette:.45+.35*t,detail:.08*t,effect:(.16+.14*t)*p.energy*q,shock:0,particles:.16*p.particles*q,scale:p.scaleFrom,profile:p.id});
  if(stage===MANIFESTATION_STAGES.HINTED)return Object.freeze({stage,progress:0,silhouette:.34,detail:0,effect:.08*p.energy*q,shock:0,particles:.08*p.particles*q,scale:p.scaleFrom,profile:p.id});
  return Object.freeze({stage:MANIFESTATION_STAGES.DORMANT,progress:0,silhouette:0,detail:0,effect:0,shock:0,particles:0,scale:p.scaleFrom,profile:p.id});
}

function notify(target){
  target.onState?.(Object.freeze({id:target.id,stage:target.stage,progress:target.progress,priority:target.priority,profile:target.profile.id,error:target.error||null}));
}

export function createProgressiveManifestation({maxConcurrent=2}={}){
  if(!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8)throw new Error('Invalid manifestation concurrency');
  const targets=new Map();let active=0,order=0,disposed=false;
  const queued=target=>target.stage===MANIFESTATION_STAGES.HINTED&&!target.promise;
  const pump=()=>{
    if(disposed)return;
    while(active<maxConcurrent){
      const target=[...targets.values()].filter(queued).sort((a,b)=>b.priority-a.priority||a.order-b.order)[0];
      if(!target)break;
      const controller=new AbortController();target.controller=controller;target.stage=MANIFESTATION_STAGES.LOADING;target.progress=Math.max(target.progress,.001);active++;notify(target);
      const onProgress=value=>{const next=Math.max(target.progress,clamp01(value));if(next===target.progress)return;target.progress=next;target.onProgress?.(next);notify(target);};
      const promise=Promise.resolve().then(()=>target.load({signal:controller.signal,onProgress}));target.promise=promise;
      promise.then(result=>{
        if(disposed||target.stage===MANIFESTATION_STAGES.FAILED)return result;
        target.result=result;target.progress=1;target.forming=0;target.stage=MANIFESTATION_STAGES.FORMING;target.onReady?.(result,target.profile);notify(target);return result;
      }).catch(error=>{
        if(disposed)return;
        target.error=String(error?.message||error);target.stage=MANIFESTATION_STAGES.FAILED;target.onFailure?.(error);notify(target);
      }).finally(()=>{active=Math.max(0,active-1);pump();});
    }
  };
  const requireTarget=id=>{const target=targets.get(id);if(!target)throw new Error(`Unknown manifestation target: ${id}`);return target;};
  const queue=(id,priority)=>{
    const target=requireTarget(id);if([MANIFESTATION_STAGES.MANIFESTED,MANIFESTATION_STAGES.FORMING,MANIFESTATION_STAGES.FAILED].includes(target.stage))return snapshot(id);
    target.priority=Math.max(target.priority,Number(priority)||0);
    if(target.stage===MANIFESTATION_STAGES.DORMANT){target.stage=MANIFESTATION_STAGES.HINTED;notify(target);}
    pump();return snapshot(id);
  };
  const snapshot=id=>{
    const row=target=>Object.freeze({id:target.id,stage:target.stage,progress:target.progress,priority:target.priority,profile:target.profile.id,formingProgress:target.stage===MANIFESTATION_STAGES.FORMING?clamp01(target.forming/target.profile.duration):target.stage===MANIFESTATION_STAGES.MANIFESTED?1:0,error:target.error||null,ready:Boolean(target.result)});
    if(id!==undefined)return row(requireTarget(id));
    return Object.freeze({active,maxConcurrent,targets:Object.freeze([...targets.values()].map(row))});
  };
  return Object.freeze({
    register(id,{load,profile='subtle',onState=null,onProgress=null,onReady=null,onManifested=null,onFailure=null}={}){
      if(disposed)throw new Error('Manifestation director disposed');
      if(typeof id!=='string'||!id||targets.has(id)||typeof load!=='function')throw new Error('Invalid manifestation target');
      const target={id,load,profile:manifestationProfileFor(profile),onState,onProgress,onReady,onManifested,onFailure,stage:MANIFESTATION_STAGES.DORMANT,progress:0,priority:0,forming:0,result:null,error:null,promise:null,controller:null,order:order++};targets.set(id,target);notify(target);return snapshot(id);
    },
    hint(id,priority=10){return queue(id,priority);},
    focus(id,priority=100){return queue(id,priority);},
    update(deltaSeconds=0){
      const dt=Math.max(0,Math.min(.25,Number(deltaSeconds)||0));
      for(const target of targets.values())if(target.stage===MANIFESTATION_STAGES.FORMING){target.forming+=dt;if(target.forming+1e-6>=target.profile.duration){target.forming=target.profile.duration;target.stage=MANIFESTATION_STAGES.MANIFESTED;target.onManifested?.(target.result,target.profile);notify(target);}}
      pump();return snapshot();
    },
    wait(id){const target=requireTarget(id);if(target.result)return Promise.resolve(target.result);if(target.stage===MANIFESTATION_STAGES.FAILED)return Promise.reject(new Error(target.error));if(target.stage===MANIFESTATION_STAGES.DORMANT)queue(id,10);return new Promise((resolve,reject)=>{const previousReady=target.onReady,previousFailure=target.onFailure;target.onReady=(result,p)=>{previousReady?.(result,p);resolve(result);};target.onFailure=error=>{previousFailure?.(error);reject(error);};});},
    snapshot,
    dispose(){if(disposed)return;disposed=true;for(const target of targets.values())target.controller?.abort?.();targets.clear();active=0;}
  });
}

export async function readResponseArrayBufferWithProgress(response,{expectedBytes=null,maxBytes=32*1024*1024,onProgress=()=>{}}={}){
  if(!response?.ok)throw new Error(`Asset HTTP ${response?.status??'unknown'}`);
  const declared=Number(response.headers?.get?.('content-length'));
  const total=Number.isFinite(expectedBytes)&&expectedBytes>0?expectedBytes:Number.isFinite(declared)&&declared>0?declared:null;
  if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('Asset exceeds progressive loading budget');
  if(!response.body?.getReader){const buffer=await response.arrayBuffer();if(buffer.byteLength>maxBytes)throw new Error('Asset exceeds progressive loading budget');onProgress(1);return buffer;}
  const reader=response.body.getReader(),chunks=[];let received=0;
  for(;;){const {done,value}=await reader.read();if(done)break;if(!value?.byteLength)continue;received+=value.byteLength;if(received>maxBytes){await reader.cancel('asset too large').catch(()=>{});throw new Error('Asset exceeds progressive loading budget');}chunks.push(value);onProgress(total?Math.min(.995,received/total):Math.min(.95,received/maxBytes));}
  const out=new Uint8Array(received);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}onProgress(1);return out.buffer;
}

function particleGeometry(count){
  const positions=new Float32Array(count*3);for(let i=0;i<count;i++){const a=i*2.399963229728653,r=.25+.75*((i*37)%101)/100,y=((i*53)%97)/96*2.2-.1;positions[i*3]=Math.cos(a)*r;positions[i*3+1]=y;positions[i*3+2]=Math.sin(a)*r;}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));return geometry;
}

export function createManifestationEffect({profile='subtle',qualityScale=1}={}){
  const p=manifestationProfileFor(profile),q=Math.max(.2,Math.min(1,Number(qualityScale)||1)),root=new Group();root.name=`Manifestation:${p.id}`;root.userData.manifestationEffect=true;
  const color=new Color(p.color),ringMaterial=new MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,blending:AdditiveBlending,side:2}),ring=new Mesh(new RingGeometry(.38,.46,32),ringMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.025;root.add(ring);
  const count=Math.max(8,Math.round(42*p.particles*q)),pointsMaterial=new PointsMaterial({color,size:.045+.035*p.energy*q,transparent:true,opacity:0,depthWrite:false,blending:AdditiveBlending}),points=new Points(particleGeometry(count),pointsMaterial);root.add(points);root.visible=false;
  return Object.freeze({
    root,profile:p,
    update(progress){const visual=manifestationVisualPhase(MANIFESTATION_STAGES.FORMING,progress,{profile:p,qualityScale:q}),t=clamp01(progress);root.visible=t<1;ringMaterial.opacity=visual.effect*.9;ring.scale.setScalar(.7+1.7*t+visual.shock*.3);pointsMaterial.opacity=visual.particles;points.rotation.y=t*Math.PI*2*(.4+p.distortion);points.scale.setScalar(.75+1.4*t);return visual;},
    dispose(){root.removeFromParent();ring.geometry.dispose();ringMaterial.dispose();points.geometry.dispose();pointsMaterial.dispose();}
  });
}
