import {PREY} from '@soul/raid/world';
import {hasCompletedFirstHunt} from './first-hunt-guide.js';

const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));

function directionLabel(player,npc){
 const dx=(npc?.x||0)-(player?.x||0),dz=(npc?.z||0)-(player?.z||0);
 const horizontal=dx<-1?'左':dx>1?'右':'';
 const vertical=dz<-1?'奥':dz>1?'手前':'';
 return horizontal&&vertical?horizontal+vertical:horizontal||vertical||'近く';
}

export function abilityNudge(role){
 return ({
  traveller:'命の余熱。次の捕食では、傷がさらに深く癒える。',
  bellkeeper:'声喰い。次の狩りでは、村の警戒が上がりにくい。',
  smith:'鉄砕く腕。正面の木柵へ押し続ければ、道をこじ開けられる。',
  hunter:'血の嗅覚。嗅覚を押さなくても、近い獲物を見失いにくい。',
  gravekeeper:'墓道の記憶。礼拝所の裏に、別の帰還口が開いている。',
  acolyte:'祈りの残滓。礼拝所の結界へ、そのまま踏み込める。',
  arcanist:'影渡り。戦闘外で素早く弾けば、影のように距離を詰められる。',
  knight:'刃骨。次の自動戦闘から、骨刃の戦い方が身体に混ざる。'
 })[role]||'喰らったものが、次の行動へ混ざった。';
}

function candidates(snapshot){
 const player=snapshot.player||{x:0,z:0},unlocked=new Set(snapshot.profile?.unlocked||[]),seen=new Set(),out=[];
 const alive=(snapshot.npcs||[]).filter(n=>!n.dead&&!n.eaten).map(n=>({...n,distance:distance(player,n)}))
  .sort((a,b)=>(Number(unlocked.has(a.role))-Number(unlocked.has(b.role)))||a.distance-b.distance);
 for(const npc of alive){
  if(seen.has(npc.role))continue;
  seen.add(npc.role);
  const prey=PREY[npc.role];
  if(!prey)continue;
  out.push({id:npc.id,role:npc.role,name:prey.name,power:prey.power,distance:Math.ceil(npc.distance),direction:directionLabel(player,npc)});
  if(out.length===2)break;
 }
 return out;
}

export function firstHuntDirectorState(snapshot){
 const profile=snapshot?.profile||{};
 if(!snapshot||snapshot.mode!=='hunt'||snapshot.finished||hasCompletedFirstHunt(profile))return{active:false,stage:'off',choices:[]};
 const player=snapshot.player||{x:0,z:0},eaten=Math.max(0,Number(snapshot.eaten)||0);
 const alive=(snapshot.npcs||[]).filter(n=>!n.dead&&!n.eaten).map(n=>({...n,distance:distance(player,n)})).sort((a,b)=>a.distance-b.distance);
 const fallen=(snapshot.npcs||[]).filter(n=>n.dead&&!n.eaten).map(n=>({...n,distance:distance(player,n)})).sort((a,b)=>a.distance-b.distance);
 if(snapshot.devouring)return{active:true,stage:'devour',guide:'そのまま止まれ。身体が取り込む。',choices:[]};
 if(snapshot.combat)return{active:true,stage:'combat',guide:'戦いは自動。勝てば、その身体を喰える。',choices:[]};
 if(eaten===0){
  if(fallen[0]&&fallen[0].distance<3.2)return{active:true,stage:'stop',guide:'倒れた獲物のそばで止まれ。喰い始める。',preyId:fallen[0].id,choices:[]};
  const prey=alive[0],kind=prey&&PREY[prey.role];
  return{active:true,stage:'approach',guide:'近い人影へ。指を滑らせるだけで戦いは始まる。',preyId:prey?.id,objectiveKicker:'最初の獲物',objective:kind?`${kind.name} · ${kind.power}`:'近い人影を追え',choices:[]};
 }
 if(eaten===1){
  const role=(snapshot.npcs||[]).find(n=>n.eaten)?.role||(profile.unlocked||[]).at(-1),choice=candidates(snapshot);
  return{active:true,stage:'choice',guide:`${abilityNudge(role)} 次は選べ。喰う相手で、次の身体が変わる。`,objectiveKicker:'次の獲物は選べ',objective:'喰う相手で身体が変わる',choices:choice};
 }
 return{active:true,stage:'free',guide:'もう分かった。狙った命を追うか、今の身体を持ち帰るか。',choices:[]};
}

function ensureUi(){
 const objective=document.querySelector('#objective');
 let choices=document.querySelector('#first-hunt-choices');
 if(!choices&&objective){choices=document.createElement('div');choices.id='first-hunt-choices';choices.hidden=true;objective.append(choices);}
 let gain=document.querySelector('#first-hunt-gain');
 if(!gain){gain=document.createElement('div');gain.id='first-hunt-gain';gain.hidden=true;gain.setAttribute('role','status');gain.setAttribute('aria-live','polite');gain.innerHTML='<small>BODY CHANGED</small><b></b><span></span>';document.body.append(gain);}
 return{choices,gain};
}

function renderChoices(root,rows){
 if(!root)return;
 root.replaceChildren();
 root.hidden=!rows.length;
 for(const row of rows){
  const card=document.createElement('div');card.className='first-hunt-choice';card.dataset.npc=row.id;
  const title=document.createElement('b');title.textContent=`${row.name} · ${row.power}`;
  const meta=document.createElement('span');meta.textContent=`${row.direction} ${row.distance}m`;
  card.append(title,meta);root.append(card);
 }
}

function showGain(root,role){
 const prey=PREY[role];if(!root||!prey)return 0;
 root.querySelector('b').textContent=prey.power;
 root.querySelector('span').textContent=prey.desc;
 root.hidden=false;
 try{navigator.vibrate?.([18,34,30]);}catch{}
 return performance.now()+3600;
}

export function installFirstHuntDirector(){
 if(!window.__NIGHT_HUNT__||window.__FIRST_HUNT_DIRECTOR__)return()=>{};
 window.__FIRST_HUNT_DIRECTOR__=true;
 const ui=ensureUi(),hud=document.querySelector('#hud'),guide=document.querySelector('#first-hunt-guide'),kicker=document.querySelector('#objective small'),objective=document.querySelector('#objective span');
 let stopped=false,gainUntil=0,previous=window.__NIGHT_HUNT__.snapshot(),previousEaten=Number(previous?.eaten)||0,previousUnlocked=new Set(previous?.profile?.unlocked||[]);
 const labelFor=id=>[...document.querySelectorAll('.nameplate')].find(el=>el.dataset.npc===id);
 function clearLabels(){for(const el of document.querySelectorAll('.nameplate.first-hunt-prey,.nameplate.first-hunt-choice-prey'))el.classList.remove('first-hunt-prey','first-hunt-choice-prey');}
 function frame(now){
  if(stopped)return;
  const snapshot=window.__NIGHT_HUNT__?.snapshot?.();
  if(snapshot){
   const state=firstHuntDirectorState(snapshot);
   document.body.classList.toggle('first-hunt-active',state.active);
   clearLabels();
   if(state.active){
    hud?.setAttribute('data-guide',state.stage);
    if(guide){guide.hidden=false;guide.dataset.step=state.stage;guide.textContent=state.guide;}
    if(state.objectiveKicker&&kicker)kicker.textContent=state.objectiveKicker;
    if(state.objective&&objective)objective.textContent=state.objective;
    labelFor(state.preyId)?.classList.add('first-hunt-prey');
    renderChoices(ui.choices,state.choices||[]);
    for(const row of state.choices||[])labelFor(row.id)?.classList.add('first-hunt-choice-prey');
   }else renderChoices(ui.choices,[]);
   const unlocked=new Set(snapshot.profile?.unlocked||[]),eaten=Number(snapshot.eaten)||0;
   if(state.active&&eaten>previousEaten){
    const added=[...unlocked].filter(role=>!previousUnlocked.has(role));
    const freshlyEaten=(snapshot.npcs||[]).find(n=>n.eaten&&!previous?.npcs?.find(old=>old.id===n.id)?.eaten);
    const role=freshlyEaten?.role||added.at(-1)||(snapshot.profile?.unlocked||[]).at(-1);
    gainUntil=showGain(ui.gain,role)||gainUntil;
   }
   previousEaten=eaten;previousUnlocked=unlocked;previous=snapshot;
  }
  if(ui.gain&&!ui.gain.hidden&&now>gainUntil)ui.gain.hidden=true;
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 return()=>{stopped=true;document.body.classList.remove('first-hunt-active');clearLabels();ui.choices?.remove();ui.gain?.remove();delete window.__FIRST_HUNT_DIRECTOR__;};
}
