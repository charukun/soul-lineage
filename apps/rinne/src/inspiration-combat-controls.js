import {activeCombo,learnedTechniqueSkills,techniqueName,toggleFavored,setOneMotion,PHASES} from './combat-loadout.js';

/** Keep the established battle controls alongside the life-owned technique journal. */
export function installInspirationCombatControls(ui,{gameScreen}){
  const doc=gameScreen.ownerDocument,win=doc.defaultView,base={open:ui.open,refresh:ui.refresh,bindState:ui.bindState,dispose:ui.dispose};
  let state=null,disposed=false,lastHost=null,lastKey='';
  const node=(tag,text)=>{const n=doc.createElement(tag);if(text!=null)n.textContent=text;return n;};
  const readonly=()=>Boolean(!state||state.ended||state.down||state.combat||doc.getElementById('game')?.dataset.coopPlayer);
  function render(){
    if(disposed||!state)return;
    const host=ui.root.querySelector('.inspiration-journal'),nav=host?.querySelector('.inspiration-combo-nav');if(!host||!nav)return;
    const combo=activeCombo(state);if(!combo)return;
    const ids=learnedTechniqueSkills(state,{oneMotion:true}),key=JSON.stringify([combo.id,combo.favored,state.combatLoadout.technique.oneMotion,ids,readonly()]);
    if(host===lastHost&&key===lastKey&&host.querySelector('[data-inspiration-combat-controls]'))return;
    lastHost=host;lastKey=key;host.querySelector('[data-inspiration-combat-controls]')?.remove();
    const box=node('section');box.dataset.inspirationCombatControls='';box.className='inspiration-body-options';box.setAttribute('aria-label','得意技と手動奥義');
    box.append(node('h3','得意技'));const choices=node('div');choices.className='inspiration-actions';
    for(const [phase,label]of PHASES){const b=node('button',`${label}を得意技にする`);b.type='button';b.dataset.favoredPhase=phase;b.dataset.active=String(Boolean(combo.favored[phase]));b.setAttribute('aria-pressed',String(Boolean(combo.favored[phase])));b.disabled=readonly();b.onclick=()=>{if(readonly())return;toggleFavored(state,combo.id,phase);lastKey='';ui.refresh();render();};choices.append(b);}
    box.append(choices,node('small','得意技のある連を、自動戦闘の候補として優先する。'));
    const label=node('label','手動奥義');label.htmlFor='inspiration-one-motion';const select=node('select');select.id='inspiration-one-motion';select.setAttribute('aria-label','手動奥義に使う技');
    const none=node('option','使わない');none.value='';select.append(none);
    for(const id of ids){const option=node('option',techniqueName(id,state));option.value=id;select.append(option);}
    select.value=state.combatLoadout.technique.oneMotion||'';select.disabled=readonly()||!ids.length;
    select.onchange=()=>{if(readonly())return;setOneMotion(state,select.value||null);lastKey='';ui.refresh();render();};
    box.append(label,select,node('small','通常の自動戦闘より消耗と隙が大きい。戦闘中の手動奥義ボタンから使う。'));
    if(!ids.length)box.append(node('small','単発指定できる既存技はありません。新しい閃き技は序・破・急に編成して使います。'));
    nav.after(box);
  }
  ui.open=function(...args){const result=base.open.apply(ui,args);render();return result;};
  ui.refresh=function(...args){const result=base.refresh.apply(ui,args);render();return result;};
  ui.bindState=function(next,...args){state=next;const result=base.bindState.call(ui,next,...args);render();return result;};
  const observer=new win.MutationObserver(render);observer.observe(ui.root,{childList:true,subtree:true});
  ui.dispose=function(...args){disposed=true;observer.disconnect();return base.dispose?.apply(ui,args);};
  return ui;
}
