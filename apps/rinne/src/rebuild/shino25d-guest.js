import {shino25dGuestEnabled} from './shino25d-guest-policy.js';
import {createSprite25dActor} from '@soul/assets/sprite25d/three';
import {readSprite25dFile,loadSprite25dDraft,saveSprite25dDraft,verifySprite25dBundle} from '@soul/assets/sprite25d/browser';
import './shino25d-guest.css';

// Opt-in visual guest only. Never writes life, combat, NPC or family state.
export function installShino25dGuest(view,options={}){
  if(!shino25dGuestEnabled(location.search,options.environment))return view;
  if(!view?.scene||!view.THREE||!view.camera)return view;
  const params=new URLSearchParams(location.search),transferToken=params.get('spriteTransfer');
  const panel=document.createElement('details');panel.className='shino25d-guest';panel.open=true;
  panel.innerHTML='<summary>しのちゃん · 仮表示</summary><p>Visual Review Labから素材を自動受信できます。必要な時だけbundleを手動選択してください。主人公やセーブは変更しません。</p><label>素材bundle<input type="file" accept="application/json,.json"></label><button type="button">隣へ呼ぶ</button><output role="status" aria-live="polite">素材を待っています</output>';
  document.body.append(panel);
  const output=panel.querySelector('output'),input=panel.querySelector('input'),abort=new AbortController();
  let actor=null,anchor=null,disposed=false,loading=false;
  const originalRender=view.renderState,originalDispose=view.dispose;
  async function install(bundle){
    const next=await createSprite25dActor(view.THREE,bundle,{shadow:true});
    if(disposed){next.dispose();return;}
    actor?.dispose();actor=next;actor.object.visible=false;view.scene.add(actor.object);anchor=null;
    output.textContent='読込済み · 村に入ると隣に仮表示します。会話・戦闘には参加しません';
  }
  async function load(work){
    if(loading||disposed)return;loading=true;input.disabled=true;
    try{await work();}catch(error){if(!disposed)output.textContent=error.message||'素材を読み込めません';}
    finally{loading=false;if(!disposed)input.disabled=false;}
  }
  input.addEventListener('change',event=>{const file=event.currentTarget.files?.[0];input.value='';if(!file)return;void load(async()=>{const bundle=await readSprite25dFile(file);await install(bundle);try{await saveSprite25dDraft(bundle);}catch(error){if(!disposed)output.textContent+=` · ${error.message}`;}});},{signal:abort.signal});
  panel.querySelector('button').addEventListener('click',()=>{anchor=null;output.textContent=actor?'近くの空いている場所へ配置します':'素材を受信するかbundleを選んでください';},{signal:abort.signal});
  for(const type of ['pointerdown','pointerup','click','keydown','keyup'])panel.addEventListener(type,event=>event.stopPropagation(),{signal:abort.signal});

  if(transferToken&&window.opener){
    window.addEventListener('message',event=>{
      if(event.source!==window.opener||event.data?.type!=='rinne.character25d.transfer'||event.data?.token!==transferToken)return;
      void load(async()=>{
        const bundle=await verifySprite25dBundle(event.data.bundle);await install(bundle);
        try{await saveSprite25dDraft(bundle);}catch(error){if(!disposed)output.textContent+=` · ${error.message}`;}
        event.source.postMessage({type:'rinne.character25d.received',token:transferToken},event.origin);
      });
    },{signal:abort.signal});
    try{window.opener.postMessage({type:'rinne.character25d.ready',token:transferToken},'*');output.textContent='Visual Review Labから素材を受信中…';}catch{output.textContent='自動受信できません。bundleを選んでください';}
  }

  function updateGuest(state,delta,renderOptions){
    if(!actor)return;
    const visible=state?.zone==='village'&&!state.interior&&!state.ended&&!renderOptions?.titlePreview;
    actor.object.visible=visible;if(!visible){anchor=null;return;}
    const player=view.scene.getObjectByName('Player');if(!player){actor.object.visible=false;return;}
    if(!anchor){
      const x=Number(state.position?.x),z=Number(state.position?.z);if(!Number.isFinite(x)||!Number.isFinite(z)){actor.object.visible=false;return;}
      for(const [dx,dz] of [[1.15,.75],[-1.15,.75],[0,1.4],[0,-1.4],[1.6,0],[-1.6,0]]){
        if(!view.canMoveTo||view.canMoveTo(x+dx,z+dz,.22,'village',null)){anchor={x:x+dx,z:z+dz,y:Number(state.position?.y)||0};break;}
      }
      if(!anchor){actor.object.visible=false;output.textContent='近くに配置できる空間がありません。広い場所で「隣へ呼ぶ」を押してください';return;}
      actor.object.position.set(anchor.x,anchor.y,anchor.z);
    }
    actor.update({camera:view.camera,delta,yaw:0,moving:false});
    const message=`仮表示 · ${actor.getStatus()} · 会話/戦闘なし`;if(output.textContent!==message)output.textContent=message;
  }
  view.renderState=function(state,delta=0,renderOptions){updateGuest(state,delta,renderOptions);return originalRender.call(this,state,delta,renderOptions);};
  const dispose=()=>{if(disposed)return;disposed=true;abort.abort();actor?.dispose();panel.remove();};
  view.dispose=function(...args){dispose();return originalDispose?.apply(this,args);};
  addEventListener('pagehide',dispose,{once:true,signal:abort.signal});
  void load(async()=>{const saved=await loadSprite25dDraft();if(saved)await install(saved);else if(!transferToken)output.textContent='素材は未登録です';});
  return view;
}
