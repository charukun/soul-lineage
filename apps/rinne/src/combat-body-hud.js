import {COMBAT_BODY_PARTS,combatBodyOutcome,combatBodySnapshot} from './rebuild/combat-choreography.js';
if(typeof document!=='undefined')void import('./combat-body-hud.css');

const PART_META=Object.freeze({
  head:Object.freeze({hint:'判断・視界',reaction:'頭部の被弾で判断と持久が落ちる'}),
  torso:Object.freeze({hint:'体幹・持久',reaction:'胴の被弾で持久と移動が落ちる'}),
  leftArm:Object.freeze({hint:'攻撃・保持',reaction:'腕の被弾で攻撃動作が鈍る'}),
  rightArm:Object.freeze({hint:'攻撃・保持',reaction:'腕の被弾で攻撃動作が鈍る'}),
  leftLeg:Object.freeze({hint:'移動・踏込',reaction:'脚の被弾で移動と踏み込みが鈍る'}),
  rightLeg:Object.freeze({hint:'移動・踏込',reaction:'脚の被弾で移動と踏み込みが鈍る'})
});
const STAGE_TONE=Object.freeze({'正常':'normal','軽傷':'light','負傷':'wounded','重傷':'severe','機能不全':'disabled'});
const REACTION=Object.freeze({'正常':'通常','軽傷':'小さくひるむ','負傷':'部位をかばう','重傷':'大きくひるむ','機能不全':'姿勢を大きく崩す'});
const pct=value=>Math.round(Math.max(0,Math.min(1,Number(value)||0))*100);

export function combatBodyHudModel(state,selectedPart=null){
  const snapshot=combatBodySnapshot(state),outcome=combatBodyOutcome(state);
  const parts=COMBAT_BODY_PARTS.map(part=>Object.freeze({...snapshot[part],id:part,tone:STAGE_TONE[snapshot[part].stage]||'normal'}));
  const chosen=COMBAT_BODY_PARTS.includes(selectedPart)?selectedPart:null;
  const selected=chosen?parts.find(part=>part.id===chosen):null;
  return Object.freeze({
    parts:Object.freeze(parts),
    selected:selected?Object.freeze({
      ...selected,
      hint:PART_META[chosen].hint,
      note:PART_META[chosen].reaction,
      reaction:REACTION[selected.stage]||'通常',
      attack:pct(outcome.attackScale),
      movement:pct(outcome.movementScale),
      judgment:pct(outcome.judgmentScale),
      stamina:pct(outcome.staminaScale)
    }):null
  });
}

function partButton(part){
  const button=document.createElement('button');
  button.type='button';
  button.className='combat-body-hud__part';
  button.dataset.bodyPart=part;
  button.setAttribute('aria-pressed','false');
  const label=document.createElement('span');
  label.className='combat-body-hud__sr';
  button.append(label);
  return button;
}
function valueRow(labelText,className){
  const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong');
  row.className='combat-body-hud__detail-row';label.textContent=labelText;value.className=className;row.append(label,value);return{row,value};
}

export function createCombatBodyHud({root}={}){
  if(!root)return null;
  root.classList.add('combat-body-hud');
  const map=document.createElement('div');map.className='combat-body-hud__map';map.setAttribute('aria-label','身体部位。タップで詳細');
  const tag=document.createElement('span');tag.className='combat-body-hud__tag';tag.textContent='身体';
  const buttons=new Map();
  for(const part of COMBAT_BODY_PARTS){const button=partButton(part);buttons.set(part,button);map.append(button);}
  const detail=document.createElement('section');detail.className='combat-body-hud__detail';detail.hidden=true;
  const head=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');
  close.type='button';close.className='combat-body-hud__close';close.textContent='×';close.setAttribute('aria-label','身体部位詳細を閉じる');head.append(title,close);
  const meter=document.createElement('div');meter.className='combat-body-hud__meter';const meterFill=document.createElement('i');meter.append(meterFill);
  const durability=valueRow('耐久','combat-body-hud__durability'),stage=valueRow('損傷','combat-body-hud__stage'),attack=valueRow('攻撃','combat-body-hud__attack'),movement=valueRow('移動','combat-body-hud__movement'),reaction=valueRow('反応','combat-body-hud__reaction');
  const note=document.createElement('p');note.className='combat-body-hud__note';
  detail.append(head,meter,durability.row,stage.row,attack.row,movement.row,reaction.row,note);
  root.replaceChildren(tag,map,detail);

  let combatState=null,selectedPart=null,flashTimer=0;
  const render=()=>{
    if(!combatState)return;
    const model=combatBodyHudModel(combatState,selectedPart);
    for(const part of model.parts){
      const button=buttons.get(part.id);if(!button)continue;
      button.dataset.tone=part.tone;button.dataset.stage=part.stage;button.style.setProperty('--body-damage',String(part.severity));
      button.setAttribute('aria-label',`${part.label} ${part.stage} 耐久${part.durability}`);
      button.setAttribute('aria-pressed',String(part.id===selectedPart));
      button.firstElementChild.textContent=part.label;
    }
    if(!model.selected){detail.hidden=true;return;}
    detail.hidden=false;detail.dataset.tone=model.selected.tone;title.textContent=`${model.selected.label} · ${model.selected.hint}`;
    durability.value.textContent=`${model.selected.durability} / 100`;
    stage.value.textContent=model.selected.stage;
    attack.value.textContent=`${model.selected.attack}%`;
    movement.value.textContent=`${model.selected.movement}%`;
    reaction.value.textContent=model.selected.reaction;
    note.textContent=model.selected.note;
    meterFill.style.width=`${model.selected.durability}%`;
  };
  map.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-body-part]');if(!button)return;
    const part=button.dataset.bodyPart;selectedPart=selectedPart===part?null:part;render();
  });
  close.addEventListener('click',()=>{selectedPart=null;render();});
  return{
    update(nextState){combatState=nextState;render();},
    select(part){selectedPart=COMBAT_BODY_PARTS.includes(part)?part:null;render();},
    flash(part){
      const button=buttons.get(part);if(!button)return;
      clearTimeout(flashTimer);for(const node of buttons.values())node.removeAttribute('data-hit');
      button.dataset.hit='true';flashTimer=setTimeout(()=>{button.removeAttribute('data-hit');flashTimer=0;},720);
    },
    destroy(){clearTimeout(flashTimer);root.replaceChildren();root.classList.remove('combat-body-hud');}
  };
}
