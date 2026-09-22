import {readSavedBody,readSavedTerrain,clearSavedPresentation} from './johakyu-save-contract.js';
import {spendActionStamina,recoverActionStamina} from '@soul/johakyu-combat/stamina';
import {WEAPONS,ARMORS} from '@soul/johakyu-combat/execution-capability';
export {WEAPONS,ARMORS} from '@soul/johakyu-combat/execution-capability';
import { DISCOVERIES, skillEffects, skillName } from './skill-system.js';
import { enterInteriorState, leaveInteriorState } from './interior-state.js';
import { ensureCombatInjuryState, recoverPersistentInjuries } from './combat-injury.js';
import { ensureInspiration, validateInspiration, advanceInspirationTime, recordLifeExperience, inspirationEffortScale, inspirationImprint, initializeBirthTalents, INSPIRATION_LIMITS } from './inspiration-state.js';
import { familyForLife, inheritFamily, settleFamily } from './family-origin.js';

export { DISCOVERIES, skillEffects, skillName };
export const SAVE_SCHEMA = 2;
export const LIFE_YEARS = 100;
export const YEAR_SECONDS = 60;
export const LIFE_SECONDS = LIFE_YEARS * YEAR_SECONDS;
export const ACTIVITY_SECONDS = 8;
export const CLOCK_RATES = Object.freeze([1, 5, 10, 20]);
export const DEFAULT_VILLAGE_ID = 'local-hoshitsugi';

export const EXPERIENCES = Object.freeze({
  play:'遊び', pray:'祈り', forge:'鍛冶見学', train:'稽古見学', study:'学び', read:'読書',
  care:'手伝い', observe:'観察', track:'足跡', maintain:'武具の手入れ', voyage:'船上の祈り', rest:'休息', combat:'実戦',
  breathe:'呼吸を整える', balance:'姿勢を整える', fall:'受身を試す', focus:'一点へ集中する', sense:'気配を読む',
  repeat:'反復する', distance:'間合いを見る', adapt:'環境へ馴染む', practice:'かかしで型を反復する',
});
const clone = value => structuredClone(value);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const cleanName = value => String(value || '旅人').trim().slice(0, 12) || '旅人';
const nowId = seed => `life-${seed >>> 0}-${Math.random().toString(36).slice(2, 9)}`;
const VILLAGE_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const validVillageId=value=>typeof value==='string'&&VILLAGE_ID.test(value);
function normalizeVillageIds(values,fallback=true){
  const list=Array.isArray(values)?values:[];
  const ids=[...new Set(list.filter(validVillageId))];
  if(ids.length>64)throw Error('出生可能な村が多すぎます。');
  if(!ids.length&&fallback)return [DEFAULT_VILLAGE_ID];
  return ids;
}
export function chooseBirthVillage(seed=1,villageIds=[DEFAULT_VILLAGE_ID]){
  seed=Number.isSafeInteger(seed)?seed>>>0:1;
  const ids=normalizeVillageIds(villageIds);
  return ids[seed%ids.length];
}
export function createLife({name='旅人',seed=1,generation=1,lineage=[],homelands=[],villageIds=[DEFAULT_VILLAGE_ID],birthVillageId=null,family=null}={}){
  seed=Number.isSafeInteger(seed)?seed>>>0:1;generation=Math.max(1,generation|0);
  const available=normalizeVillageIds(villageIds),unlocked=normalizeVillageIds(homelands,false);
  let village;
  if(birthVillageId!==null){
    if(!validVillageId(birthVillageId))throw Error('出生村IDが不正です。');
    if(generation<=1)throw Error('最初の人生の出生村はランダムに決まります。');
    if(!unlocked.includes(birthVillageId))throw Error('帰還していない村には生まれ直せません。');
    if(!available.includes(birthVillageId))throw Error('その故郷は現在の出生先に選べません。');
    village=birthVillageId;
  }else village=chooseBirthVillage(seed,available);
  const state={
    schemaVersion:SAVE_SCHEMA,id:nowId(seed),name:cleanName(name),seed,generation,
    phase:'birth',zone:'village',front:0,lastDepartureCycle:2,ended:false,birthVillageId:village,homelands:unlocked,
    ageSeconds:0,ageYears:0,clockRate:1,position:{x:-7,z:-1},yaw:Math.PI,moving:false,resting:true,idleSeconds:0,interior:null,
    hp:100,maxHp:100,stamina:100,staminaCap:100,lastSpendSeconds:999,combatStrategy:'balanced',equipment:{weapon:'fist',armor:'cloth',shield:false},
    knownSkills:['basic.fist'],skillWeights:{jo:{'basic.fist':100},ha:{},kyu:{}},experiences:{},experienceRecent:{},pendingDiscoveries:[],activity:null,
    combat:null,defeats:0,returns:0,history:[],lineage:Array.isArray(lineage)?clone(lineage).slice(-INSPIRATION_LIMITS.lineage):[],
    events:[{type:'born',worldSecond:0,text:`${cleanName(name)}が${village}に生まれた。`}],
  };
  state.family=settleFamily(familyForLife({...state,family}),village,{generation:state.generation,lifeId:state.id});
  ensureInspiration(state,{fresh:true});const tenyo=initializeBirthTalents(state);
  if(tenyo)state.events.unshift({type:'village-news',scope:'village',worldSecond:0,text:`${state.name}が「${tenyo.axis}」に稀有な資質を持って生まれた。村に「天与」の子の知らせが広がった。`,tag:'天与',subjectId:state.id,communityHook:{kind:'protect-tenyo-child',roles:['見守り役','師匠候補','将来の共闘仲間']}});
  ensureCombatInjuryState(state);return state;
}
export function validateLife(raw){
  if(!raw||raw.schemaVersion!==SAVE_SCHEMA)throw Error('保存データの形式が違います。');
  if(!Number.isFinite(raw.ageSeconds)||raw.ageSeconds<0||raw.ageSeconds>LIFE_SECONDS)throw Error('年齢データが不正です。');
  if(!CLOCK_RATES.includes(raw.clockRate))throw Error('時間倍率が不正です。');
  if(!raw.position||!Number.isFinite(raw.position.x)||!Number.isFinite(raw.position.z))throw Error('位置データが不正です。');
  if(!WEAPONS[raw.equipment?.weapon]||!ARMORS[raw.equipment?.armor]||typeof raw.equipment.shield!=='boolean')throw Error('装備データが不正です。');
  if(!Array.isArray(raw.knownSkills)||raw.knownSkills.length>256||!raw.experiences||typeof raw.experiences!=='object')throw Error('人生データが不正です。');
  const state=clone(raw);state.birthVillageId??=DEFAULT_VILLAGE_ID;state.homelands??=[];state.interior??=null;state.combatStrategy??='balanced';
  if(!validVillageId(state.birthVillageId))throw Error('出生村IDが不正です。');
  if(!Array.isArray(state.homelands)||state.homelands.length>64||new Set(state.homelands).size!==state.homelands.length||state.homelands.some(id=>!validVillageId(id)))throw Error('故郷の記録が不正です。');
  if(state.interior!==null){const row=state.interior,p=row?.returnPosition;if(!row||typeof row.buildingId!=='string'||!row.buildingId||row.buildingId.length>100||!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))throw Error('建物内の位置データが不正です。');state.interior={buildingId:row.buildingId,returnPosition:{x:p.x,z:p.z}};}
  if(!Array.isArray(state.lineage))throw Error('系譜の記録が不正です。');
  state.lineage=state.lineage.slice(-INSPIRATION_LIMITS.lineage);
  state.name=cleanName(state.name);state.ageYears=state.ageSeconds/YEAR_SECONDS;
  state.family=familyForLife(state);
  // Migrate before injury cleanup so explicitly chosen legacy loadouts remain usable.
  state.injuries=readSavedBody(state.injuries);if(state.frontState){if(!Array.isArray(state.frontState.enemies))throw Error('遭遇の保存データが不正です。');for(const enemy of state.frontState.enemies)enemy.injuries=readSavedBody(enemy.injuries);if(state.frontState.terrain)state.frontState.terrain=readSavedTerrain(state.frontState.terrain);}validateInspiration(state);ensureCombatInjuryState(state);recoverPersistentInjuries(state);return state;
}
export function serializeLife(state){return JSON.stringify(clearSavedPresentation(validateLife(state)));}
export function deserializeLife(text){if(typeof text!=='string'||text.length>250_000)throw Error('保存データが大きすぎます。');return clearSavedPresentation(validateLife(JSON.parse(text)));}
export function setClockRate(state,rate){rate=Number(rate);if(!CLOCK_RATES.includes(rate))throw Error('選べない時間倍率です。');state.clockRate=rate;return state;}
function pushEvent(state,type,text){state.events.unshift({type,worldSecond:Math.floor(state.ageSeconds),text});if(state.events.length>80)state.events.length=80;}
function addKnownSkill(state,id){if(state.knownSkills.includes(id))return false;state.knownSkills.push(id);return true;}
function observeExperience(state,kind,station){
  const now=state.ageSeconds,last=state.experienceRecent[kind]??-1e9;
  if(now-last<5)return [];
  const repeated=state.experiences[kind]?.count||0,gain=Math.max(.32,1-Math.min(.68,repeated*.055));
  state.experienceRecent[kind]=now;state.experiences[kind]={count:repeated+1,score:(state.experiences[kind]?.score||0)+gain,last:now};
  // Legacy scores remain historical only. The causal engine consumes the actual episode, never this counter.
  return recordLifeExperience(state,kind,{place:station?.label||station?.id||state.birthVillageId,terrain:state.interior?'interior':'open'});
}
export function practiceDummy(state,station){
  if(!station?.trainingDummy||state.phase!=='living'||state.ended||state.down||state.zone!=='village'||state.interior)return [];
  const events=[{type:'training-hit',stationId:station.id,label:station.label||'かかし'}],now=state.ageSeconds,last=state.experienceRecent.practice??-1e9;
  if(now-last<5)return events;
  const repeated=state.experiences.practice?.count||0,gain=Math.max(.32,1-Math.min(.68,repeated*.055));
  state.experienceRecent.practice=now;state.experiences.practice={count:repeated+1,score:(state.experiences.practice?.score||0)+gain,last:now};
  const discoveries=recordLifeExperience(state,'practice',{place:station.label||'かかし',terrain:'dojo',encounter:'training',description:'かかしへ実際に打ち込み、間合いと打ち終わりを確かめた'});
  pushEvent(state,'experience','かかしへの打ち込みが経験として残った。');
  events.push({type:'activity-complete',kind:'practice',sparks:discoveries.map(e=>e.id)},...discoveries);return events;
}
export function acceptDiscoveries(state){if(Array.isArray(state.pendingDiscoveries))state.pendingDiscoveries.length=0;return [];}
export function startAutomaticActivity(state,station){
  if(!station?.activity||state.ageYears<4||state.phase!=='living'||state.combat||state.ended)return false;
  if(state.activity?.stationId===station.id)return false;
  state.activity={stationId:station.id,kind:station.activity,label:station.actionLabel||EXPERIENCES[station.activity]||station.label,elapsed:0};state.resting=false;pushEvent(state,'activity',`${state.activity.label}を始めた。`);return true;
}
export function stopAutomaticActivity(state,reason='move'){if(!state.activity)return false;if(reason==='move')pushEvent(state,'activity','歩き出した。');state.activity=null;return true;}
export function enterBuilding(state,station){const changed=enterInteriorState(state,station);if(changed)pushEvent(state,'building',`${station.label}へ入った。`);return changed;}
export function leaveBuilding(state){const changed=leaveInteriorState(state);if(changed)pushEvent(state,'building','建物の外へ出た。');return changed;}
export function applyEquipmentStation(state,station){
  if(!station?.equipment||state.ageYears<7||state.phase!=='living'||state.combat||state.ended)return null;
  const before=JSON.stringify(state.equipment),next={...state.equipment,...station.equipment};if(!WEAPONS[next.weapon]||!ARMORS[next.armor])return null;
  state.equipment=next;if(next.weapon!=='fist')addKnownSkill(state,WEAPONS[next.weapon].skill);if(before===JSON.stringify(next))return null;
  pushEvent(state,'equipment',`${station.label}に持ち替えた。`);return clone(next);
}
export function setMoving(state,moving,yaw=state.yaw){state.moving=Boolean(moving);if(Number.isFinite(yaw))state.yaw=yaw;if(state.moving){state.idleSeconds=0;state.resting=false;stopAutomaticActivity(state,'move');}return state;}
function recover(state,dt){
  ensureCombatInjuryState(state);recoverPersistentInjuries(state);
  const armor=ARMORS[state.equipment.armor],effects=skillEffects(state);
  recoverActionStamina(state,dt,{capBase:100*armor.staminaScale,recovery:effects.recovery});
}
export function staminaMultiplierFor(state){
  const effects=skillEffects(state);return Math.max(0,(1+effects.staminaCost)*inspirationEffortScale(state));
}
export function spendStamina(state,amount){
  amount=Math.max(0,(Number(amount)||0)*staminaMultiplierFor(state));
  return spendActionStamina(state,amount);
}
export function endLifeEarly(state,cause='戦い'){
  if(state.ended)return false;state.ended=true;state.phase='ended';state.moving=false;state.resting=false;state.activity=null;state.combat=null;state.down=null;state.interior=null;state.hp=0;
  if(state.inspiration)state.inspiration.pending=null;pushEvent(state,'life-end',`${cause}で命を落とした。`);return true;
}
export function tickLife(state,{realDelta,lifeDelta=realDelta,station=null,paused=false}={}){
  if(!Number.isFinite(realDelta)||realDelta<0||realDelta>.25)throw Error('時間刻みが不正です。');if(!Number.isFinite(lifeDelta)||lifeDelta<0)throw Error('人生時間が不正です。');
  const events=[];if(paused||state.ended)return events;advanceInspirationTime(state,realDelta);
  const beforeYear=Math.floor(state.ageYears);state.ageSeconds=Math.min(LIFE_SECONDS,state.ageSeconds+lifeDelta*state.clockRate);state.ageYears=state.ageSeconds/YEAR_SECONDS;recoverPersistentInjuries(state);
  const afterYear=Math.floor(state.ageYears);if(beforeYear<4&&afterYear>=4&&state.phase==='birth'){state.phase='living';state.resting=false;pushEvent(state,'release','4歳。自分の足で歩き始めた。');events.push({type:'release'});}
  if(afterYear>beforeYear)events.push({type:'birthday',age:afterYear});recover(state,realDelta);
  if(state.moving){
  }else if(station?.equipment){const changed=applyEquipmentStation(state,station);if(changed)events.push({type:'equipment',equipment:changed,station});}
  else if(station?.activity){if(startAutomaticActivity(state,station))events.push({type:'activity-start',station});}
  else if(state.activity){state.activity=null;events.push({type:'activity-stop'});}
  if(state.activity){state.activity.elapsed+=realDelta;if(state.activity.elapsed>=ACTIVITY_SECONDS){const kind=state.activity.kind,label=state.activity.label;state.activity=null;const discoveries=observeExperience(state,kind,station);pushEvent(state,'experience',`${label}が経験として残った。`);events.push({type:'activity-complete',kind,sparks:discoveries.map(e=>e.id)},...discoveries);}}
  if(state.ageSeconds>=LIFE_SECONDS&&!state.ended){state.ageSeconds=LIFE_SECONDS;state.ageYears=LIFE_YEARS;state.ended=true;state.phase='ended';state.moving=false;state.activity=null;state.combat=null;state.interior=null;state.inspiration.pending=null;pushEvent(state,'life-end','100年の生涯を生き終えた。');events.push({type:'life-end',cause:'old-age'});}
  return events;
}
export function departureCycle(state){return Math.floor(state.ageYears/5);}
export function canDepart(state){return state.phase==='living'&&!state.ended&&!state.combat&&!state.interior&&state.ageYears>=15&&departureCycle(state)>state.lastDepartureCycle;}
export function depart(state){if(!canDepart(state))return false;state.lastDepartureCycle=departureCycle(state);state.zone='frontier';if(state.rangedCombat){state.rangedCombat.projectiles=[];state.rangedCombat.cooldown=0;}state.front=0;state.position={x:0,z:5.2};state.resting=false;state.activity=null;state.interior=null;pushEvent(state,'depart','前線へ向けて出航した。');return true;}
export function advanceFront(state){if(state.zone!=='frontier'||state.front>=5)return false;if(state.rangedCombat){state.rangedCombat.projectiles=[];state.rangedCombat.cooldown=0;}state.front++;state.position={x:0,z:5.2};state.combat=null;pushEvent(state,'front',`第${state.front+1}前線へ進んだ。`);return true;}
export function returnHome(state){
  if(state.zone!=='frontier')return false;if(state.rangedCombat){state.rangedCombat.projectiles=[];state.rangedCombat.cooldown=0;}state.zone='village';state.front=0;state.position={x:166,z:0};state.combat=null;state.interior=null;state.returns++;
  const firstReturn=!state.homelands.includes(state.birthVillageId);if(firstReturn)state.homelands.push(state.birthVillageId);pushEvent(state,'return',firstReturn?'村へ帰還した。この村が一族の故郷として刻まれた。':'村へ帰還した。');return true;
}
export function objectiveFor(state){
  if(state.ended)return 'この生涯を記録し、次の人生へ';if(state.phase==='birth')return '母と村を歩き、4歳まで世界を知る';if(state.activity)return `${state.activity.label}を続ける`;if(state.interior)return '建物の中を見て、暮らしを知る';
  if(state.ageYears<7)return '村を歩き、暮らしを知る';if(state.ageYears<15)return state.equipment.weapon==='fist'?'武具のそばへ行き、自分の得物を試す':'暮らしながら、技と装備を試す';
  if(state.zone==='village')return canDepart(state)?'港へ行けば、次の船で前線へ出る':'暮らしながら、次の出航を待つ';return state.front>=5?'魔王軍の主力を退け、帰還する':'前線を生き抜き、奥へ進む';
}
export function lineageRecord(state,memento=null){return {lifeId:state.id,familyId:familyForLife(state).id,generation:state.generation,name:state.name,age:Math.floor(state.ageYears),birthVillageId:state.birthVillageId,returnedHome:state.returns>0,memento:memento||null,defeats:state.defeats,equipment:clone(state.equipment),experiences:clone(state.experiences),skills:[...state.knownSkills],inspirationImprint:inspirationImprint(state)};}
export function rebirth(state,{name=state.name,memento=null,seed=(state.seed+0x9e3779b9)>>>0,villageId=null,villageIds=[state.birthVillageId]}={}){
  const record=lineageRecord(state,memento),family=inheritFamily(state),next=createLife({name,seed,generation:state.generation+1,lineage:[...state.lineage,record],homelands:state.homelands,villageIds,birthVillageId:villageId,family});
  next.lineageArchive={earlierGenerations:Math.max(0,next.generation-1-next.lineage.length)};return next;
}
