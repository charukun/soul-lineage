import {COMBAT_BODY_PARTS,combatBodyOutcome,combatBodySnapshot} from './rebuild/combat-choreography.js';
if(typeof document!=='undefined')void import('./combat-body-hud.css');

const PART_META=Object.freeze({
  head:{hint:'判断・視界',note:'頭をかばい、相手の動きをよく見よう。'},
  torso:{hint:'体幹・持久',note:'体幹の傷は移動・判断・持久に響く。'},
  leftArm:{hint:'攻撃・保持',note:'左腕をかばうため、攻撃の動きが鈍る。'},
  rightArm:{hint:'攻撃・保持',note:'右腕をかばうため、攻撃の動きが鈍る。'},
  leftLeg:{hint:'移動・踏込',note:'左脚をかばうため、移動と踏み込みが鈍る。'},
  rightLeg:{hint:'移動・踏込',note:'右脚をかばうため、移動と踏み込みが鈍る。'}
});
const STAGE_TONE=Object.freeze({'正常':'normal','軽傷':'light','負傷':'wounded','重傷':'severe','機能不全':'disabled'});
const STAGE_MARK=Object.freeze({'正常':'','軽傷':'·','負傷':'Ⅱ','重傷':'!','機能不全':'×'});
const REACTION=Object.freeze({'正常':'通常','軽傷':'小さくひるむ','負傷':'部位をかばう','重傷':'大きくひるむ','機能不全':'姿勢を大きく崩す'});
const pct=value=>Math.round(Math.max(0,Math.min(1,Number(value)||0))*100);
let instanceId=0;

// The canonical helpers normalize/recover their input. A HUD must not advance
// recovery or strip progression from the live game merely by rendering it.
function presentationState(state,onlyPart=null){
  const now=Number(state?.ageSeconds)||0;
  return{ageSeconds:now,injuries:Object.fromEntries(COMBAT_BODY_PARTS.map(part=>{
    const row=state?.injuries?.[part];
    return[part,{severity:onlyPart&&part!==onlyPart?0:(row&&typeof row==='object'?row.severity:row)||0,at:now}];
  }))};
}
export function combatBodyHudModel(state,selectedPart=null){
  const view=presentationState(state),snapshot=combatBodySnapshot(view),outcome=combatBodyOutcome(view);
  const parts=COMBAT_BODY_PARTS.map(id=>Object.freeze({...snapshot[id],id,tone:STAGE_TONE[snapshot[id].stage],mark:STAGE_MARK[snapshot[id].stage]}));
  const selected=parts.find(part=>part.id===selectedPart)||null;
  const worst=parts.reduce((a,b)=>b.severity>a.severity?b:a);
  const damagedCount=parts.filter(part=>part.stage!=='正常').length;
  const isolated=selected?combatBodyOutcome(presentationState(state,selected.id)):null;
  return Object.freeze({parts:Object.freeze(parts),worst,damagedCount,
    selected:selected?Object.freeze({...selected,...PART_META[selected.id],reaction:REACTION[selected.stage],
      // Existing total fields remain available; the detail explicitly labels
      // the selected part's contribution, obtained from the SAME authority.
      attack:pct(outcome.attackScale),movement:pct(outcome.movementScale),judgment:pct(outcome.judgmentScale),stamina:pct(outcome.staminaScale),
      impact:Object.freeze({attack:100-pct(isolated.attackScale),movement:100-pct(isolated.movementScale),judgment:100-pct(isolated.judgmentScale),stamina:100-pct(isolated.staminaScale)})
    }):null});
}

const ART=Object.freeze({
  head:{view:'0 0 44 40',shape:'M22 3C10 3 4 10 4 21C4 33 12 38 22 38S40 33 40 21C40 10 34 3 22 3Z',detail:'<path class="combat-body-hud__hair" d="M5 19C2 7 12 1 22 2C34 1 42 9 39 20L34 13L31 17L25 11L19 15L13 12L9 20Z"/><path class="combat-body-hud__ink" d="M13 24v2m18-2v2m-12 3q3 3 6 0"/><path class="combat-body-hud__cheek" d="M9 29h4m18 0h4"/>'},
  torso:{view:'0 0 34 38',shape:'M8 2Q17 5 26 2L32 10L29 31Q17 39 5 31L2 10Z',detail:'<path class="combat-body-hud__seam" d="M9 3L23 18L26 31M26 3L12 18"/><path class="combat-body-hud__sash" d="M5 20Q17 23 29 20L29 26Q17 29 5 26Z"/><path class="combat-body-hud__seam" d="M17 22l-4 3l4 3l4-3Z"/>'},
  rightArm:{view:'0 0 26 42',shape:'M20 3Q13 1 9 9L3 26Q0 35 8 38Q15 40 17 32L23 14Q25 6 20 3Z',detail:'<path class="combat-body-hud__seam" d="M4 27l12 5M16 11l-5 14"/>'},
  leftArm:{view:'0 0 26 42',shape:'M6 3Q13 1 17 9L23 26Q26 35 18 38Q11 40 9 32L3 14Q1 6 6 3Z',detail:'<path class="combat-body-hud__seam" d="M10 32l12-5M10 11l5 14"/>'},
  rightLeg:{view:'0 0 26 32',shape:'M8 2L23 3L21 21Q23 28 13 29L6 29Q0 27 4 21Z',detail:'<path class="combat-body-hud__seam" d="M5 21q8 4 16 0M13 5l-2 12"/>'},
  leftLeg:{view:'0 0 26 32',shape:'M3 3L18 2L22 21Q26 27 20 29L13 29Q3 28 5 21Z',detail:'<path class="combat-body-hud__seam" d="M5 21q8 4 16 0M13 5l2 12"/>'}
});
function el(doc,tag,className,text){const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function partButton(doc,part,uid){
  const button=el(doc,'button','combat-body-hud__part');button.type='button';button.dataset.bodyPart=part;
  const art=ART[part],clip=`${uid}-${part}`;
  // Static, authored SVG: no asset fetch, user markup, or CSS-block anatomy.
  button.innerHTML=`<svg class="combat-body-hud__part-art" viewBox="${art.view}" aria-hidden="true" focusable="false"><defs><clipPath id="${clip}"><path d="${art.shape}"/></clipPath></defs><path class="combat-body-hud__shape" d="${art.shape}"/>${art.detail}<path class="combat-body-hud__hatch" clip-path="url(#${clip})" d="M-10 12L16-14M-10 23L27-14M-10 34L38-14M-10 45L49-14M-10 56L60-14M-10 67L71-14"/></svg><span class="combat-body-hud__mark" aria-hidden="true"></span>`;
  button.setAttribute('aria-pressed','false');button.setAttribute('aria-expanded','false');return button;
}
function valueRow(doc,labelText,className){const row=el(doc,'div','combat-body-hud__detail-row'),label=el(doc,'dt','',labelText),value=el(doc,'dd',className);row.append(label,value);return{row,value};}
const lossText=value=>value?`−${value}%`:'影響なし';

export function createCombatBodyHud({root}={}){
  if(!root)return null;
  const doc=root.ownerDocument,win=doc.defaultView,uid=`combat-body-${++instanceId}`;
  root.classList.add('combat-body-hud');root.dataset.expanded='false';
  const charm=el(doc,'div','combat-body-hud__charm'),map=el(doc,'div','combat-body-hud__map');
  map.setAttribute('role','group');map.setAttribute('aria-label','身体部位。正面図、左右は本人基準。タップで詳細');
  const frame=el(doc,'div','combat-body-hud__frame');frame.setAttribute('aria-hidden','true');
  frame.innerHTML='<svg viewBox="0 0 96 162" focusable="false"><path class="combat-body-hud__plaque" d="M29 8Q48 0 67 8L87 25L89 131Q88 147 48 157Q8 147 7 131L9 25Z"/><path class="combat-body-hud__rim" d="M29 12Q48 4 67 12L83 27L85 129Q84 143 48 153Q12 143 11 129L13 27Z"/><path class="combat-body-hud__cord" d="M38 9Q27-2 36 1Q43 2 48 10Q53 2 60 1Q69-2 58 9M36 12Q48 5 60 12"/></svg>';
  const tag=el(doc,'span','combat-body-hud__tag','身体'),right=el(doc,'span','combat-body-hud__side combat-body-hud__side--right','右'),left=el(doc,'span','combat-body-hud__side combat-body-hud__side--left','左');right.setAttribute('aria-hidden','true');left.setAttribute('aria-hidden','true');
  const buttons=new Map();
  for(const part of COMBAT_BODY_PARTS){const button=partButton(doc,part,uid);buttons.set(part,button);map.append(button);}
  map.append(right,left);
  const summary=el(doc,'button','combat-body-hud__summary');summary.type='button';
  const summaryName=el(doc,'span','combat-body-hud__summary-name'),summaryStage=el(doc,'strong','combat-body-hud__summary-stage');summary.append(summaryName,summaryStage);
  charm.append(frame,tag,map,summary);
  const detail=el(doc,'section','combat-body-hud__detail');detail.id=`${uid}-detail`;detail.hidden=true;detail.setAttribute('aria-label','身体部位の詳細');
  const head=el(doc,'header'),heading=el(doc,'div'),title=el(doc,'strong','combat-body-hud__title'),hint=el(doc,'span','combat-body-hud__hint'),close=el(doc,'button','combat-body-hud__close','×');
  title.id=`${uid}-title`;detail.setAttribute('aria-labelledby',title.id);heading.append(title,hint);
  close.type='button';close.setAttribute('aria-label','身体部位詳細を閉じる');head.append(heading,close);
  const meter=el(doc,'div','combat-body-hud__meter'),meterFill=el(doc,'i');meter.setAttribute('aria-hidden','true');meter.append(meterFill);
  const list=el(doc,'dl','combat-body-hud__values'),durability=valueRow(doc,'耐久','combat-body-hud__durability'),stage=valueRow(doc,'損傷段階','combat-body-hud__stage'),attack=valueRow(doc,'攻撃影響','combat-body-hud__attack'),movement=valueRow(doc,'移動影響','combat-body-hud__movement'),reaction=valueRow(doc,'反応','combat-body-hud__reaction');
  list.append(durability.row,stage.row,attack.row,movement.row,reaction.row);
  const impact=el(doc,'p','combat-body-hud__impact'),note=el(doc,'p','combat-body-hud__note'),legend=el(doc,'p','combat-body-hud__legend','· 軽傷　Ⅱ 負傷　! 重傷　× 機能不全');
  detail.append(head,meter,list,impact,note,legend);root.replaceChildren(charm,detail);
  for(const button of [...buttons.values(),summary])button.setAttribute('aria-controls',detail.id);

  let combatState=null,selectedPart=null,lastModel=null,lastSignature='',lastTrigger=null,layoutFrame=0,disposed=false;
  const flashes=new Map();
  const positionDetail=()=>{
    layoutFrame=0;if(disposed||detail.hidden)return;
    const anchor=charm.getBoundingClientRect(),host=root.getBoundingClientRect(),boundary=(root.closest('.stage')||root.parentElement).getBoundingClientRect(),vv=win.visualViewport;
    const leftBound=Math.max(boundary.left,vv?.offsetLeft||0)+6,rightBound=Math.min(boundary.right,(vv?.offsetLeft||0)+(vv?.width||win.innerWidth))-6;
    const topBound=Math.max(boundary.top,vv?.offsetTop||0)+6,bottomBound=Math.min(boundary.bottom,(vv?.offsetTop||0)+(vv?.height||win.innerHeight))-6;
    const rightRoom=rightBound-anchor.right-7,beside=rightRoom>=184,width=Math.max(1,Math.min(248,beside?rightRoom:rightBound-leftBound));
    detail.style.width=`${width}px`;
    const x=beside?anchor.right+7:leftBound;
    let y=beside?Math.max(topBound,anchor.top):anchor.bottom+6;
    if(bottomBound-y<180)y=topBound;
    const height=Math.max(1,bottomBound-y);
    detail.style.maxHeight=`${height}px`;detail.style.left=`${Math.max(leftBound,Math.min(x,rightBound-width))-host.left}px`;detail.style.top=`${y-host.top}px`;
    detail.dataset.placement=beside?'beside':'below';
  };
  const scheduleLayout=()=>{if(!layoutFrame&&!detail.hidden&&!disposed)layoutFrame=win.requestAnimationFrame(positionDetail);};
  const render=()=>{
    if(disposed||!combatState)return;
    const model=combatBodyHudModel(combatState,selectedPart);lastModel=model;
    const signature=`${selectedPart}|${model.parts.map(p=>`${p.id}:${p.durability}:${p.stage}`).join('|')}`;
    if(signature===lastSignature)return;lastSignature=signature;
    for(const part of model.parts){
      const button=buttons.get(part.id);button.dataset.tone=part.tone;button.dataset.stage=part.stage;button.dataset.durability=String(part.durability);
      button.setAttribute('aria-label',`${part.label} ${part.stage} 耐久${part.durability} / 100`);
      button.setAttribute('aria-pressed',String(part.id===selectedPart));button.setAttribute('aria-expanded',String(part.id===selectedPart));
      button.querySelector('.combat-body-hud__mark').textContent=part.mark;
    }
    const damaged=model.damagedCount>0;
    charm.dataset.tone=model.worst.tone;summaryName.textContent=damaged?`${model.worst.label} · ${model.damagedCount}部位`:'からだの調子';summaryStage.textContent=damaged?model.worst.stage:'健やか';
    summary.setAttribute('aria-label',damaged?`${model.damagedCount}部位に損傷。最も深い傷は${model.worst.label}、${model.worst.stage}。詳細`:'身体は正常。タップで詳細');summary.setAttribute('aria-expanded',String(Boolean(model.selected)));
    detail.hidden=!model.selected;root.dataset.expanded=String(Boolean(model.selected));if(!model.selected)return;
    const part=model.selected;detail.dataset.tone=part.tone;title.textContent=part.label;hint.textContent=part.hint;
    durability.value.textContent=`${part.durability} / 100`;stage.value.textContent=`${part.mark} ${part.stage}`.trim();
    attack.value.textContent=lossText(part.impact.attack);movement.value.textContent=lossText(part.impact.movement);reaction.value.textContent=part.reaction;
    impact.textContent=`この部位：判断 ${lossText(part.impact.judgment)} · 持久 ${lossText(part.impact.stamina)}`;
    note.textContent=part.stage==='正常'?'損傷なし。いつもどおり動ける。':part.note;
    meterFill.style.width=`${part.durability}%`;scheduleLayout();
  };
  const choose=(part,trigger)=>{lastTrigger=trigger||null;selectedPart=selectedPart===part?null:part;render();};
  const closeDetail=(restoreFocus=false)=>{selectedPart=null;render();if(restoreFocus)lastTrigger?.focus();};
  const onMapClick=event=>{const button=event.target.closest?.('[data-body-part]');if(button&&map.contains(button))choose(button.dataset.bodyPart,button);};
  const onSummary=()=>{if(selectedPart)closeDetail();else choose(lastModel?.worst?.id||'head',summary);};
  const onClose=()=>closeDetail(true);
  const onOutside=event=>{if(selectedPart&&!root.contains(event.target))closeDetail();};
  const onKey=event=>{if(event.key==='Escape'&&selectedPart){event.preventDefault();event.stopPropagation();closeDetail(true);}};
  const stopGameInput=event=>event.stopPropagation();
  map.addEventListener('click',onMapClick);summary.addEventListener('click',onSummary);close.addEventListener('click',onClose);
  for(const type of ['pointerdown','pointerup','click','dblclick'])root.addEventListener(type,stopGameInput);
  root.addEventListener('keydown',onKey);doc.addEventListener('pointerdown',onOutside,true);doc.addEventListener('scroll',scheduleLayout,true);win.addEventListener('resize',scheduleLayout);win.visualViewport?.addEventListener('resize',scheduleLayout);win.visualViewport?.addEventListener('scroll',scheduleLayout);
  const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(scheduleLayout):null;resize?.observe(root.parentElement);
  return{
    update(nextState){combatState=nextState||{};render();},
    select(part){selectedPart=COMBAT_BODY_PARTS.includes(part)?part:null;render();},
    flash(part){
      const button=buttons.get(part);if(disposed||!button)return;
      clearTimeout(flashes.get(part));button.dataset.hit='true';button.dataset.hitPulse=button.dataset.hitPulse==='a'?'b':'a';
      flashes.set(part,setTimeout(()=>{button.removeAttribute('data-hit');flashes.delete(part);},560));
    },
    destroy(){
      if(disposed)return;disposed=true;for(const timer of flashes.values())clearTimeout(timer);flashes.clear();if(layoutFrame)win.cancelAnimationFrame(layoutFrame);resize?.disconnect();
      doc.removeEventListener('pointerdown',onOutside,true);doc.removeEventListener('scroll',scheduleLayout,true);win.removeEventListener('resize',scheduleLayout);win.visualViewport?.removeEventListener('resize',scheduleLayout);win.visualViewport?.removeEventListener('scroll',scheduleLayout);
      for(const type of ['pointerdown','pointerup','click','dblclick'])root.removeEventListener(type,stopGameInput);root.removeEventListener('keydown',onKey);
      root.replaceChildren();root.classList.remove('combat-body-hud');root.removeAttribute('data-expanded');
    }
  };
}
