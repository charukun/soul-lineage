import {COMBAT_BODY_PARTS,combatBodyOutcome,combatBodySnapshot} from '@soul/johakyu-combat/choreography';
import './battle2-body-hud.css';

const META=Object.freeze({
 head:['判断・視界','頭部の損傷で判断と持久が落ちる'],
 torso:['体幹・持久','胴の損傷で持久と移動が落ちる'],
 leftArm:['攻撃・保持','腕の損傷で攻撃動作が鈍る'],
 rightArm:['攻撃・保持','腕の損傷で攻撃動作が鈍る'],
 leftLeg:['移動・踏込','脚の損傷で移動と踏み込みが鈍る'],
 rightLeg:['移動・踏込','脚の損傷で移動と踏み込みが鈍る'],
});
const TONE={'正常':'normal','軽傷':'light','負傷':'wounded','重傷':'severe','機能不全':'disabled'};
const pct=v=>Math.round(Math.max(0,Math.min(1,Number(v)||0))*100);
function actorState(actor){
 const injuries={};for(const part of COMBAT_BODY_PARTS)injuries[part]={severity:Number(actor?.body?.[part]?.severity)||0,at:0};
 return {seed:1,generation:1,ageSeconds:0,maxHp:Number(actor?.maxHp)||125,injuries};
}
export function battle2BodyModel(actor,selectedPart=null){
 const state=actorState(actor),body=combatBodySnapshot(state),outcome=combatBodyOutcome(state);
 const parts=COMBAT_BODY_PARTS.map(id=>({...body[id],id,tone:TONE[body[id].stage]||'normal'}));
 const selected=parts.find(row=>row.id===selectedPart)||null;
 return {parts,selected:selected?{...selected,hint:META[selected.id][0],note:META[selected.id][1],attack:pct(outcome.attackScale),movement:pct(outcome.movementScale),judgment:pct(outcome.judgmentScale),stamina:pct(outcome.staminaScale)}:null};
}
function row(label,cls){const el=document.createElement('div'),k=document.createElement('span'),v=document.createElement('strong');el.className='battle2-body-hud__row';k.textContent=label;v.className=cls;el.append(k,v);return{el,v};}
export function createBattle2BodyHud(root){
 if(!root)return null;root.classList.add('battle2-body-hud');root.hidden=true;
 const badge=document.createElement('span');badge.className='battle2-body-hud__badge';badge.textContent='身体';
 const figure=document.createElement('div');figure.className='battle2-body-hud__figure';figure.setAttribute('aria-label','身体部位。タップで詳細');
 const buttons=new Map();
 for(const part of COMBAT_BODY_PARTS){const b=document.createElement('button');b.type='button';b.dataset.bodyPart=part;b.className='battle2-body-hud__part';b.setAttribute('aria-pressed','false');b.append(Object.assign(document.createElement('span'),{className:'battle2-body-hud__sr'}));buttons.set(part,b);figure.append(b);}
 const detail=document.createElement('section');detail.className='battle2-body-hud__detail';detail.hidden=true;
 const header=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','閉じる');header.append(title,close);
 const meter=document.createElement('div');meter.className='battle2-body-hud__meter';const fill=document.createElement('i');meter.append(fill);
 const durability=row('耐久','durability'),stage=row('状態','stage'),attack=row('攻撃','attack'),movement=row('移動','movement'),judgment=row('判断','judgment'),stamina=row('持久','stamina');
 const grid=document.createElement('div');grid.className='battle2-body-hud__grid';grid.append(durability.el,stage.el,attack.el,movement.el,judgment.el,stamina.el);
 const note=document.createElement('p');detail.append(header,meter,grid,note);root.replaceChildren(badge,figure,detail);
 let actor=null,selected=null,previous=new Map(),timer=0;
 function render(){
  if(!actor)return;const model=battle2BodyModel(actor,selected);
  for(const part of model.parts){const b=buttons.get(part.id);b.dataset.tone=part.tone;b.dataset.stage=part.stage;b.setAttribute('aria-label',`${part.label} ${part.stage} 耐久${part.durability}`);b.setAttribute('aria-pressed',String(selected===part.id));b.firstElementChild.textContent=part.label;}
  if(!model.selected){detail.hidden=true;return;}detail.hidden=false;title.textContent=`${model.selected.label} · ${model.selected.stage}`;durability.v.textContent=`${model.selected.durability}`;stage.v.textContent=model.selected.hint;attack.v.textContent=`${model.selected.attack}%`;movement.v.textContent=`${model.selected.movement}%`;judgment.v.textContent=`${model.selected.judgment}%`;stamina.v.textContent=`${model.selected.stamina}%`;fill.style.width=`${model.selected.durability}%`;note.textContent=`影響: ${model.selected.note.replace('の損傷で',' → ').replace('が落ちる','低下').replace('が鈍る','低下')}`;
 }
 function flash(part){const b=buttons.get(part);if(!b)return;clearTimeout(timer);for(const n of buttons.values())n.removeAttribute('data-hit');b.dataset.hit='true';timer=setTimeout(()=>b.removeAttribute('data-hit'),680);}
 figure.addEventListener('click',e=>{const b=e.target.closest?.('[data-body-part]');if(!b)return;selected=selected===b.dataset.bodyPart?null:b.dataset.bodyPart;render();});close.addEventListener('click',()=>{selected=null;render();});
 return {setVisible(v){root.hidden=!v;},update(next){actor=next;const model=battle2BodyModel(actor);for(const p of model.parts){const before=previous.get(p.id)??p.severity;if(p.severity>before+.0001)flash(p.id);previous.set(p.id,p.severity);}render();},destroy(){clearTimeout(timer);root.replaceChildren();}};
}
