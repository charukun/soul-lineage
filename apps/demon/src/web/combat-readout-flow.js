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
  flow.innerHTML='<span class="combat-action-outgoing"></span><span class="combat-action-current"></span>';
  source.insertAdjacentElement('afterend',flow);

  const outgoing=flow.querySelector('.combat-action-outgoing');
  const current=flow.querySelector('.combat-action-current');
  let state={action:'',phase:''};

  const sync=()=>{
    const active=phaseNodes.find(el=>el.classList.contains('active'));
    const next=nextCombatReadoutState(state,source.textContent,active?.dataset.phase||'');

    if(next.actionChanged){
      if(state.action){
        outgoing.textContent=state.action;
        replay(outgoing,'combat-action-exit');
      }
      current.textContent=next.action;
      if(next.action)replay(current,'combat-action-enter');
      flow.hidden=!next.action;
    }

    if(next.phaseChanged&&next.phase){
      const node=phaseNodes.find(el=>el.dataset.phase===next.phase);
      if(node)replay(node,'combat-phase-shift');
    }

    state={action:next.action,phase:next.phase};
  };

  const observer=new MutationObserver(sync);
  observer.observe(battle,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
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
