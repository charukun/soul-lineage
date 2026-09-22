import {COMBAT_BODY_PARTS,combatBodySnapshot} from '@soul/johakyu-combat/choreography';
import './battle2-body-hud.css';

const TONE={'正常':'normal','軽傷':'light','負傷':'wounded','重傷':'severe','機能不全':'disabled'};
function actorState(actor){
 const injuries={};for(const part of COMBAT_BODY_PARTS)injuries[part]={severity:Number(actor?.body?.[part]?.severity)||0,at:0};
 return {seed:1,generation:1,ageSeconds:0,maxHp:Number(actor?.maxHp)||125,injuries};
}
export function battle2BodyModel(actor){
 const body=combatBodySnapshot(actorState(actor));
 return {parts:COMBAT_BODY_PARTS.map(id=>({...body[id],id,tone:TONE[body[id].stage]||'normal'}))};
}
export function createBattle2BodyHud(root){
 if(!root)return null;root.classList.add('battle2-body-hud');root.hidden=true;
 const figure=document.createElement('div');figure.className='battle2-body-hud__figure';figure.tabIndex=0;figure.setAttribute('role','button');figure.setAttribute('aria-expanded','false');figure.setAttribute('aria-label','身体部位。タップで全体の耐久を見る');
 const parts=new Map();for(const part of COMBAT_BODY_PARTS){const node=document.createElement('i');node.dataset.bodyPart=part;node.className='battle2-body-hud__part';parts.set(part,node);figure.append(node);}
 const detail=document.createElement('section');detail.className='battle2-body-hud__detail';detail.hidden=true;
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','閉じる');detail.append(close);
 const list=document.createElement('div');list.className='battle2-body-hud__list';const gauges=new Map();
 for(const part of COMBAT_BODY_PARTS){const row=document.createElement('div');row.className='battle2-body-hud__gauge';row.dataset.bodyPart=part;const label=document.createElement('span'),meter=document.createElement('b'),fill=document.createElement('i');meter.append(fill);row.append(label,meter);row.setAttribute('aria-label',part);list.append(row);gauges.set(part,{row,label,fill});}
 detail.append(list);root.replaceChildren(figure,detail);
 let actor=null,open=false,previous=new Map(),timer=0;
 function render(){
  if(!actor)return;const model=battle2BodyModel(actor);
  for(const part of model.parts){const node=parts.get(part.id),gauge=gauges.get(part.id);node.dataset.tone=part.tone;node.dataset.stage=part.stage;node.setAttribute('aria-label',part.label+' '+part.stage);gauge.row.dataset.tone=part.tone;gauge.row.setAttribute('aria-label',part.label+' '+part.stage);gauge.label.textContent=part.label;gauge.fill.style.width=part.durability+'%';}
  detail.hidden=!open;figure.setAttribute('aria-expanded',String(open));
 }
 function toggle(){open=!open;render();}
 function flash(part){const node=parts.get(part);if(!node)return;clearTimeout(timer);for(const n of parts.values())n.removeAttribute('data-hit');node.dataset.hit='true';timer=setTimeout(()=>node.removeAttribute('data-hit'),560);}
 figure.addEventListener('click',toggle);figure.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();toggle();});close.addEventListener('click',()=>{open=false;render();figure.focus();});
 return {setVisible(v){root.hidden=!v;},update(next){actor=next;const model=battle2BodyModel(actor);for(const part of model.parts){const before=previous.get(part.id)??part.severity;if(part.severity>before+.0001)flash(part.id);previous.set(part.id,part.severity);}render();},destroy(){clearTimeout(timer);root.replaceChildren();}};
}
