export const SAVE_SCHEMA = 2;
export const LIFE_YEARS = 100;
export const YEAR_SECONDS = 60;
export const LIFE_SECONDS = LIFE_YEARS * YEAR_SECONDS;
export const ACTIVITY_SECONDS = 8;
export const CLOCK_RATES = Object.freeze([1, 5, 10, 20]);
export const DEFAULT_VILLAGE_ID = 'local-hoshitsugi';

export const WEAPONS = Object.freeze({
  fist: { id:'fist', label:'素手', skill:'basic.fist', reach:1.05, stamina:5, power:8 },
  sword: { id:'sword', label:'片手剣', skill:'basic.sword', reach:1.45, stamina:9, power:13 },
  dagger: { id:'dagger', label:'短剣', skill:'basic.dagger', reach:1.0, stamina:6, power:10 },
  great: { id:'great', label:'大剣', skill:'basic.great', reach:1.7, stamina:16, power:20 },
  spear: { id:'spear', label:'槍', skill:'basic.spear', reach:2.15, stamina:11, power:15 },
  axe: { id:'axe', label:'戦斧', skill:'basic.axe', reach:1.45, stamina:14, power:18 },
  staff: { id:'staff', label:'杖', skill:'basic.staff', reach:1.75, stamina:10, power:12 },
});
export const ARMORS = Object.freeze({
  cloth: { id:'cloth', label:'服', guard:0, staminaScale:1 },
  light: { id:'light', label:'軽鎧', guard:.15, staminaScale:.94 },
  heavy: { id:'heavy', label:'重鎧', guard:.28, staminaScale:.84 },
});

export const EXPERIENCES = Object.freeze({
  play:'遊び', pray:'祈り', forge:'鍛冶見学', train:'稽古見学', study:'学び', read:'読書',
  care:'手伝い', observe:'観察', track:'足跡', maintain:'武具の手入れ', voyage:'船上の祈り', rest:'休息', combat:'実戦',
});

export const DISCOVERIES = Object.freeze([
  { id:'skill.step', name:'踏み込み', needs:['play','train'] },
  { id:'skill.calm', name:'静心', needs:['pray','rest'] },
  { id:'skill.read', name:'先読み', needs:['study','observe'] },
  { id:'skill.edge', name:'刃筋', needs:['forge','maintain'] },
  { id:'skill.trail', name:'追歩', needs:['track','play'] },
  { id:'skill.resolve', name:'不退', needs:['care','combat'] },
]);

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

export function createLife({name='旅人', seed=1, generation=1, lineage=[], homelands=[], villageIds=[DEFAULT_VILLAGE_ID], birthVillageId=null}={}) {
  seed = Number.isSafeInteger(seed) ? seed >>> 0 : 1;
  generation=Math.max(1,generation|0);
  const available=normalizeVillageIds(villageIds),unlocked=normalizeVillageIds(homelands,false);
  let village;
  if(birthVillageId!==null){
    if(!validVillageId(birthVillageId))throw Error('出生村IDが不正です。');
    if(generation<=1)throw Error('最初の人生の出生村はランダムに決まります。');
    if(!unlocked.includes(birthVillageId))throw Error('帰還していない村には生まれ直せません。');
    if(!available.includes(birthVillageId))throw Error('その故郷は現在の出生先に選べません。');
    village=birthVillageId;
  }else village=chooseBirthVillage(seed,available);
  return {
    schemaVersion:SAVE_SCHEMA,
    id:nowId(seed), name:cleanName(name), seed, generation,
    phase:'birth', zone:'village', front:0, lastDepartureCycle:2, ended:false,
    birthVillageId:village, homelands:unlocked,
    ageSeconds:0, ageYears:0, clockRate:1,
    position:{x:-7,z:-1}, yaw:Math.PI, moving:false, resting:true, idleSeconds:0,
    hp:100, maxHp:100, stamina:100, staminaCap:100, lastSpendSeconds:999,
    equipment:{weapon:'fist',armor:'cloth',shield:false},
    knownSkills:['basic.fist'], skillWeights:{jo:{'basic.fist':100},ha:{},kyu:{}},
    experiences:{}, experienceRecent:{}, pendingDiscoveries:[], activity:null,
    combat:null, defeats:0, returns:0,
    history:[], lineage:Array.isArray(lineage)?clone(lineage):[],
    events:[{type:'born',worldSecond:0,text:`${cleanName(name)}が${village}に生まれた。`}],
  };
}

export function validateLife(raw) {
  if (!raw || raw.schemaVersion !== SAVE_SCHEMA) throw Error('保存データの形式が違います。');
  if (!Number.isFinite(raw.ageSeconds) || raw.ageSeconds < 0 || raw.ageSeconds > LIFE_SECONDS) throw Error('年齢データが不正です。');
  if (!CLOCK_RATES.includes(raw.clockRate)) throw Error('時間倍率が不正です。');
  if (!raw.position || !Number.isFinite(raw.position.x) || !Number.isFinite(raw.position.z)) throw Error('位置データが不正です。');
  if (!WEAPONS[raw.equipment?.weapon] || !ARMORS[raw.equipment?.armor] || typeof raw.equipment.shield !== 'boolean') throw Error('装備データが不正です。');
  if (!Array.isArray(raw.knownSkills) || raw.knownSkills.length > 256 || !raw.experiences || typeof raw.experiences !== 'object') throw Error('人生データが不正です。');
  const state=clone(raw);
  state.birthVillageId??=DEFAULT_VILLAGE_ID;state.homelands??=[];
  if(!validVillageId(state.birthVillageId))throw Error('出生村IDが不正です。');
  if(!Array.isArray(state.homelands)||state.homelands.length>64||new Set(state.homelands).size!==state.homelands.length||state.homelands.some(id=>!validVillageId(id)))throw Error('故郷の記録が不正です。');
  state.name=cleanName(state.name); state.ageYears=state.ageSeconds/YEAR_SECONDS; return state;
}

export function serializeLife(state) { return JSON.stringify(validateLife(state)); }
export function deserializeLife(text) {
  if (typeof text !== 'string' || text.length > 250_000) throw Error('保存データが大きすぎます。');
  return validateLife(JSON.parse(text));
}

export function setClockRate(state, rate) {
  rate=Number(rate); if(!CLOCK_RATES.includes(rate)) throw Error('選べない時間倍率です。'); state.clockRate=rate; return state;
}

function pushEvent(state,type,text) {
  state.events.unshift({type,worldSecond:Math.floor(state.ageSeconds),text});
  if(state.events.length>80)state.events.length=80;
}

function addKnownSkill(state,id) {
  if(state.knownSkills.includes(id)) return false;
  state.knownSkills.push(id);
  return true;
}

function observeExperience(state, kind) {
  const now=state.ageSeconds, last=state.experienceRecent[kind] ?? -1e9;
  if(now-last < 5) return [];
  const repeated=(state.experiences[kind]?.count||0);
  const gain=Math.max(.25,1-Math.min(.75,repeated*.07));
  state.experienceRecent[kind]=now;
  state.experiences[kind]={count:repeated+1,score:(state.experiences[kind]?.score||0)+gain,last:now};
  const unlocked=[];
  for(const row of DISCOVERIES){
    if(state.knownSkills.includes(row.id)||state.pendingDiscoveries.includes(row.id))continue;
    if(row.needs.every(k=>(state.experiences[k]?.score||0)>=1)){
      state.pendingDiscoveries.push(row.id); unlocked.push(row.id);
      pushEvent(state,'spark',`${row.name}の気配が閃いた。`);
    }
  }
  return unlocked;
}

export function acceptDiscoveries(state) {
  const accepted=[];
  for(const id of state.pendingDiscoveries.splice(0)) if(addKnownSkill(state,id)) accepted.push(id);
  return accepted;
}

export function startAutomaticActivity(state, station) {
  if(!station?.activity || state.ageYears<4 || state.phase!=='living' || state.combat || state.ended) return false;
  if(state.activity?.stationId===station.id)return false;
  state.activity={stationId:station.id,kind:station.activity,label:station.actionLabel||EXPERIENCES[station.activity]||station.label,elapsed:0};
  state.resting=false;
  pushEvent(state,'activity',`${state.activity.label}を始めた。`);
  return true;
}

export function stopAutomaticActivity(state, reason='move') {
  if(!state.activity)return false;
  if(reason==='move')pushEvent(state,'activity','歩き出した。');
  state.activity=null; return true;
}

export function applyEquipmentStation(state, station) {
  if(!station?.equipment || state.ageYears<7 || state.phase!=='living' || state.combat || state.ended)return null;
  const before=JSON.stringify(state.equipment), next={...state.equipment,...station.equipment};
  if(!WEAPONS[next.weapon]||!ARMORS[next.armor])return null;
  state.equipment=next;
  if(next.weapon!=='fist') addKnownSkill(state,WEAPONS[next.weapon].skill);
  if(before===JSON.stringify(next))return null;
  pushEvent(state,'equipment',`${station.label}に持ち替えた。`);
  return clone(next);
}

export function setMoving(state, moving, yaw=state.yaw) {
  state.moving=Boolean(moving); if(Number.isFinite(yaw))state.yaw=yaw;
  if(state.moving){state.idleSeconds=0;state.resting=false;stopAutomaticActivity(state,'move');}
  return state;
}

function recover(state, dt) {
  const armor=ARMORS[state.equipment.armor], capBase=100*armor.staminaScale;
  state.staminaCap=clamp(Math.min(state.staminaCap,capBase),22,100);
  state.lastSpendSeconds+=dt;
  if(state.moving){state.stamina=Math.min(state.staminaCap,state.stamina+4*dt);return;}
  state.idleSeconds+=dt;
  if(state.idleSeconds>=.48 && !state.activity && !state.combat) state.resting=true;
  const rest=state.resting && state.idleSeconds>=.35;
  if(state.lastSpendSeconds>=.55)state.stamina=Math.min(state.staminaCap,state.stamina+(rest?32:14)*dt);
  if(rest)state.staminaCap=Math.min(capBase,state.staminaCap+8*dt);
  else if(state.lastSpendSeconds>=6)state.staminaCap=Math.min(capBase,state.staminaCap+.2*dt);
  if(rest && state.hp<state.maxHp)state.hp=Math.min(state.maxHp,state.hp+1.2*dt);
}

export function spendStamina(state, amount) {
  amount=Math.max(0,Number(amount)||0);if(state.stamina<amount)return false;
  state.stamina-=amount;state.staminaCap=Math.max(22,state.staminaCap-amount*.08);state.lastSpendSeconds=0;return true;
}

export function tickLife(state,{realDelta,station=null,paused=false}={}) {
  if(!Number.isFinite(realDelta)||realDelta<0||realDelta>.25)throw Error('時間刻みが不正です。');
  const events=[];
  if(paused||state.ended)return events;
  const beforeYear=Math.floor(state.ageYears);
  state.ageSeconds=Math.min(LIFE_SECONDS,state.ageSeconds+realDelta*state.clockRate);
  state.ageYears=state.ageSeconds/YEAR_SECONDS;
  const afterYear=Math.floor(state.ageYears);
  if(beforeYear<4&&afterYear>=4&&state.phase==='birth'){
    state.phase='living';state.resting=false;pushEvent(state,'release','4歳。自分の足で歩き始めた。');events.push({type:'release'});
  }
  if(afterYear>beforeYear)events.push({type:'birthday',age:afterYear});
  recover(state,realDelta);

  if(state.moving){
  } else if(station?.equipment){
    const changed=applyEquipmentStation(state,station);if(changed)events.push({type:'equipment',equipment:changed,station});
  } else if(station?.activity){
    if(startAutomaticActivity(state,station))events.push({type:'activity-start',station});
  } else if(state.activity){
    state.activity=null;events.push({type:'activity-stop'});
  }

  if(state.activity){
    state.activity.elapsed+=realDelta;
    if(state.activity.elapsed>=ACTIVITY_SECONDS){
      const kind=state.activity.kind,label=state.activity.label;state.activity=null;
      const sparks=observeExperience(state,kind);pushEvent(state,'experience',`${label}が経験として残った。`);
      events.push({type:'activity-complete',kind,sparks});
      const accepted=acceptDiscoveries(state);if(accepted.length)events.push({type:'skills',ids:accepted});
    }
  }

  if(state.ageSeconds>=LIFE_SECONDS&&!state.ended){
    state.ageSeconds=LIFE_SECONDS;state.ageYears=LIFE_YEARS;state.ended=true;state.phase='ended';state.moving=false;state.activity=null;state.combat=null;
    pushEvent(state,'life-end','100年の生涯を生き終えた。');events.push({type:'life-end'});
  }
  return events;
}

export function departureCycle(state){return Math.floor(state.ageYears/5);}
export function canDepart(state){return state.phase==='living'&&!state.ended&&!state.combat&&state.ageYears>=15&&departureCycle(state)>state.lastDepartureCycle;}
export function depart(state){
  if(!canDepart(state))return false;state.lastDepartureCycle=departureCycle(state);state.zone='frontier';state.front=0;state.position={x:0,z:5.2};state.resting=false;state.activity=null;pushEvent(state,'depart','前線へ向けて出航した。');return true;
}
export function advanceFront(state){if(state.zone!=='frontier'||state.front>=5)return false;state.front++;state.position={x:0,z:5.2};state.combat=null;pushEvent(state,'front',`第${state.front+1}前線へ進んだ。`);return true;}
export function returnHome(state){
  if(state.zone!=='frontier')return false;
  state.zone='village';state.front=0;state.position={x:166,z:0};state.combat=null;state.returns++;
  const firstReturn=!state.homelands.includes(state.birthVillageId);
  if(firstReturn)state.homelands.push(state.birthVillageId);
  pushEvent(state,'return',firstReturn?'村へ帰還した。この村が一族の故郷として刻まれた。':'村へ帰還した。');return true;
}

export function objectiveFor(state) {
  if(state.ended)return 'この100年を記録し、次の人生へ';
  if(state.phase==='birth')return '母と村を歩き、4歳まで世界を知る';
  if(state.activity)return `${state.activity.label}を続ける`;
  if(state.ageYears<7)return '村を歩き、暮らしの中から経験を得る';
  if(state.ageYears<15)return state.equipment.weapon==='fist'?'武具のそばへ行き、自分の得物を見つける':'暮らしながら、技と装備を育てる';
  if(state.zone==='village')return canDepart(state)?'港へ行けば、次の船で前線へ出る':'暮らしながら、次の出航を待つ';
  return state.front>=5?'魔王軍の主力を退け、帰還する':'前線を生き抜き、奥へ進む';
}

export function lineageRecord(state,memento=null) {
  return {generation:state.generation,name:state.name,age:Math.floor(state.ageYears),birthVillageId:state.birthVillageId,returnedHome:state.returns>0,memento:memento||null,defeats:state.defeats,equipment:clone(state.equipment),experiences:clone(state.experiences),skills:[...state.knownSkills]};
}

export function rebirth(state,{name=state.name,memento=null,seed=(state.seed+0x9e3779b9)>>>0,villageId=null,villageIds=[state.birthVillageId]}={}) {
  const record=lineageRecord(state,memento);
  return createLife({name,seed,generation:state.generation+1,lineage:[...state.lineage,record],homelands:state.homelands,villageIds,birthVillageId:villageId});
}
