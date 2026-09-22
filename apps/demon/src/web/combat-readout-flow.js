import './combat-readout-flow.css';
import {nextCombatReadoutState} from './combat-readout-state.js';

function replay(el,className){
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

export function installCombatReadoutFlow(doc=document){
  const battle=doc.getElementById('battle');
  const source=doc.getElementById('skill-name');
  const phaseNodes=[...doc.querySelectorAll('[data-phase]')];
  if(!battle||!source||!phaseNodes.length||source.dataset.flowInstalled==='1')return()=>{};

  source.dataset.flowInstalled='1';
  source.classList.add('combat-action-source');

  const flow=doc.createElement('div');
  flow.id='combat-action-flow';
  flow.innerHTML='<div class="combat-feed"><span class="combat-feed-baseline">自動戦闘 · スワイプで間合い</span><div class="combat-feed-events" role="log" aria-live="polite" aria-relevant="additions"></div></div>';
  source.insertAdjacentElement('afterend',flow);

  const feed=flow.querySelector('.combat-feed-events');
  let state={action:'',phase:''};

  const pushEntry=(text,kind='action')=>{
    const value=String(text||'').trim();
    if(!value)return;
    const item=doc.createElement('span');
    item.className='combat-feed-entry';
    item.dataset.kind=kind;
    item.textContent=value;
    feed.prepend(item);
    replay(item,'combat-feed-event');
    setTimeout(()=>item.remove(),2700);
    flow.hidden=false;
  };

  const reset=()=>{
    state={action:'',phase:''};
    feed.replaceChildren();
    flow.hidden=true;
  };

  const sync=()=>{
    const fighting=battle.style.opacity==='1';
    if(!fighting){reset();return;}

    const active=phaseNodes.find(el=>el.classList.contains('active'));
    const next=nextCombatReadoutState(state,source.textContent,active?.dataset.phase||'');

    flow.hidden=false;
    if(next.actionChanged&&next.action&&next.action!=='間合いを測る')pushEntry(next.action,'action');

    if(next.phaseChanged&&next.phase){
      battle.dataset.phase=next.phase;
      const node=phaseNodes.find(el=>el.dataset.phase===next.phase);
      if(node)replay(node,'combat-phase-shift');
    }
    if(next.actionChanged&&next.action){
      const link=next.phase==='jo'?battle.querySelector('[data-phase-link="jo-ha"]'):next.phase==='ha'?battle.querySelector('[data-phase-link="ha-kyu"]'):null;
      if(link)replay(link,'combat-phase-pulse-once');
      if(next.phase==='kyu')replay(phaseNodes.find(el=>el.dataset.phase==='kyu'),'combat-phase-impact-once');
    }

    state={action:next.action,phase:next.phase};
  };

  const onFeed=event=>{
    if(battle.style.opacity!=='1')return;
    pushEntry(event.detail?.text,event.detail?.kind||'status');
  };
  doc.addEventListener('demon-combat-feed',onFeed);

  const observer=new MutationObserver(sync);
  observer.observe(battle,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style']});
  sync();

  return()=>{
    observer.disconnect();
    doc.removeEventListener('demon-combat-feed',onFeed);
    flow.remove();
    source.classList.remove('combat-action-source');
    delete source.dataset.flowInstalled;
  };
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installCombatReadoutFlow(),{once:true});
  else installCombatReadoutFlow();
}
