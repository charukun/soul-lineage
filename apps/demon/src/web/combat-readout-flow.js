import './combat-readout-flow.css';
import {nextCombatReadoutState} from './combat-readout-state.js';

function replay(el,className){
  el.classList.remove(className);
  // Reflow is intentional here and only happens when the semantic value changes.
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
  flow.setAttribute('aria-hidden','true');
  flow.innerHTML='<span class="combat-action-current"></span><div class="combat-action-history"></div>';
  source.insertAdjacentElement('afterend',flow);

  const current=flow.querySelector('.combat-action-current');
  const history=flow.querySelector('.combat-action-history');
  let state={action:'',phase:''},entries=[];

  const reset=()=>{
    state={action:'',phase:''};
    current.textContent='';
    history.replaceChildren();
    entries=[];
    flow.hidden=true;
  };

  const sync=()=>{
    const fighting=battle.style.opacity==='1';
    if(!fighting){reset();return;}

    const active=phaseNodes.find(el=>el.classList.contains('active'));
    const next=nextCombatReadoutState(state,source.textContent,active?.dataset.phase||'');

    if(next.actionChanged){
      if(state.action){
        const item=doc.createElement('span');item.textContent=state.action;history.prepend(item);entries.unshift(item);replay(item,'combat-action-history-exit');
        while(entries.length>4)entries.pop()?.remove();
      }
      current.textContent=next.action;
      if(next.action)replay(current,'combat-action-enter');
      flow.hidden=!next.action;
    }

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

  const observer=new MutationObserver(sync);
  observer.observe(battle,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style']});
  sync();

  return()=>{
    observer.disconnect();
    flow.remove();
    source.classList.remove('combat-action-source');
    delete source.dataset.flowInstalled;
  };
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installCombatReadoutFlow(),{once:true});
  else installCombatReadoutFlow();
}
