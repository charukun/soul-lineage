import './johakyu-world-renderer.css';
import {createNocturneSound} from '@soul/johakyu-presentation/audio';
import {DEV_ASSET_ORIGIN} from '@soul/assets';
import {readRinneBattleFrame,readRinneImpactEvents} from './johakyu-presentation-contract.js';

/** Accepted DEV presentation. Legacy remains an immediate rollback option. */
export function installJohakyuPresentation(view,{canvas,document,buildInfo,loadRuntime=()=>Promise.all([import('@soul/johakyu-presentation'),import('@soul/johakyu-presentation/audio')])}){
  const environment=String(buildInfo?.environment||'local');
  if(!['dev','development','staging','local'].includes(environment))return view;
  const storageKey=`rinne:${environment}:battle-presentation-v1`,parent=canvas.parentElement;
  const original={front:view.syncFront.bind(view),update:view.updateFront.bind(view),render:view.renderState.bind(view),camera:view.cameraVector.bind(view),peers:view.syncPeers.bind(view),dispose:view.dispose.bind(view),resize:view.resize.bind(view),events:view.presentCombatEvents?.bind(view),clear:view.clearCombatEffects?.bind(view)};
  let preference='johakyu',runtime=null,sound=null,loading=null,controller=null,epoch=0,revision=0,batch=0,peers=[],pending=[],active=false,disposed=false,failed=false,lastReason='',overlay=null,currentFront=null,rejectedBattle=null;
  try{const saved=localStorage.getItem(storageKey);if(saved==='legacy'||saved==='johakyu')preference=saved;}catch{}
  if(preference==='johakyu')sound=createNocturneSound(document);
  const form=document.querySelector('#title-settings-dialog form');
  const setting=document.createElement('div');setting.className='setting-row';
  const label=document.createElement('label');label.textContent='戦闘描画';label.htmlFor='johakyu-presentation-select';
  const select=document.createElement('select');select.id=label.htmlFor;select.setAttribute('aria-label','戦闘描画');
  for(const [value,text] of [['legacy','従来'],['johakyu','序破急']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  const status=document.createElement('small');status.setAttribute('aria-live','polite');setting.append(label,select,status);form?.append(setting);select.value=preference;
  function report(reason=''){lastReason=reason;canvas.dataset.battlePresentation=active?'johakyu':preference==='johakyu'?'legacy-fallback':'legacy';parent.dataset.battlePresentation=canvas.dataset.battlePresentation;status.textContent=reason?'未受入の装備・動作、または読込失敗のため従来描画を使用中':'';if(reason)canvas.dataset.battlePresentationReason=reason;else delete canvas.dataset.battlePresentationReason;}
  function deactivate({clear=false}={}){active=false;if(overlay)overlay.hidden=true;if(clear){pending=[];epoch++;runtime?.clear();sound?.pause();}report(lastReason);}
  function disposeCandidate(){controller?.abort();runtime?.dispose();sound?.destroy();runtime=null;sound=null;overlay?.remove();overlay=null;loading=null;}
  async function ensureRuntime(){
    if(runtime||loading||disposed)return;
    controller=new AbortController();const own=controller;
    loading=(async()=>{
      try{
        const [module,audio]=await loadRuntime();if(disposed||own.signal.aborted)return;
        overlay=document.createElement('div');overlay.className='johakyu-world';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');
        Object.assign(overlay.style,{position:'absolute',inset:'0',pointerEvents:'none'});
        const world=document.createElement('canvas'),effects=document.createElement('canvas');
        for(const node of [world,effects]){Object.assign(node.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',background:'transparent'});overlay.append(node);}
        // Adjacent to the original canvas, below its existing HUD siblings.
        canvas.after(overlay);sound??=audio.createNocturneSound(document);
        const candidate=module.createDrivenBattleRuntime({world,effects,stage:parent,sound,notify:()=>{},signal:own.signal,cameraPresentation:view.presentationCamera});
        runtime=candidate;await candidate.prepare({assetBase:DEV_ASSET_ORIGIN});
        if(disposed||own.signal.aborted){candidate.dispose();return;}
        pending=[];epoch++;report('');
      }catch(error){if(!own.signal.aborted){failed=true;lastReason=String(error?.message||error);deactivate({clear:true});disposeCandidate();}}
      finally{if(controller===own)loading=null;}
    })();
  }
  select.addEventListener('change',()=>{preference=select.value;try{localStorage.setItem(storageKey,preference);}catch{}failed=false;lastReason='';rejectedBattle=null;deactivate({clear:true});if(preference==='legacy')disposeCandidate();else sound??=createNocturneSound(document);report('');});
  view.renderState=(state,dt=0,...rest)=>{
    if(disposed)return;
    if(failed||preference!=='johakyu'||state.zone!=='frontier' ){deactivate({clear:active});return original.render(state,dt,...rest);}
    const snapshot=readRinneBattleFrame(state,currentFront||state.frontState,{peers,epoch,revision:++revision});
    if(!snapshot){deactivate({clear:active});return original.render(state,dt,...rest);}
    // Do not spend bandwidth/context memory on a known unsupported costume.
    const unsupported=snapshot.actors.find(row=>row.kind==='hero'&&row.equipment.armor!=='heavy'||row.equipment.weapon&&!['fist','sword','great'].includes(row.equipment.weapon));
    if(rejectedBattle===snapshot.battleId)return original.render(state,dt,...rest);
    if(unsupported){rejectedBattle=snapshot.battleId;lastReason=`unaccepted-equipment:${unsupported.id}`;deactivate({clear:active});return original.render(state,dt,...rest);}
    if(!runtime||loading){void ensureRuntime();return original.render(state,dt,...rest);}
    try{
      const result=runtime.present(snapshot,Math.max(0,Math.min(.25,dt)),pending);pending=[];
      if(!result.accepted){rejectedBattle=snapshot.battleId;lastReason=result.reason;deactivate({clear:active});return original.render(state,dt,...rest);}
      if(!active)original.clear?.();active=true;overlay.hidden=false;report('');
    }catch(error){lastReason=String(error?.message||error);deactivate({clear:true});original.render(state,dt,...rest);}
  };
  view.syncFront=front=>{currentFront=front;return original.front(front);};
  view.updateFront=front=>{currentFront=front;return original.update(front);};
  view.syncPeers=rows=>{peers=Array.isArray(rows)?rows:[];return original.peers(rows);};
  view.presentCombatEvents=(events,context={})=>{if(preference==='johakyu'&&context.state?.zone==='frontier')pending.push(...readRinneImpactEvents(events,context.state,{batchId:context.eventKey||`local:${epoch}:${++batch}`}));if(pending.length>256)pending=pending.slice(-256);if(!active)original.events?.(events,context);};
  view.clearCombatEffects=()=>{original.clear?.();pending=[];epoch++;runtime?.clear();sound?.pause();};
  view.cameraVector=axis=>active?runtime.cameraVector(axis):original.camera(axis);
  view.combatAnchor=()=>active?runtime.anchor():null;
  view.resize=(...args)=>{original.resize(...args);runtime?.resize();};
  const hidden=()=>{if(document.hidden)view.clearCombatEffects();};document.addEventListener('visibilitychange',hidden);
  view.dispose=()=>{if(disposed)return;disposed=true;document.removeEventListener('visibilitychange',hidden);setting.remove();disposeCandidate();original.dispose();};
  report('');return view;
}
