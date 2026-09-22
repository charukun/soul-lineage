/** Pair-scoped interpretation of executor facts. No contact, damage, cost or cursor authority. */
const freeze=Object.freeze;
const MODES=new Set(['read','pressure','reversal','zanshin']);
const NORMAL_PHASES=new Set(['jo','ha','kyu']);
const PHASES=new Set([...NORMAL_PHASES,'uke','one','finisher','enemy']);
const RETAIN=new Set(['guard','slip','deflection','blade-contact']);
const FAILURE=new Set(['execution-blocked','capability-failure','disengage','incapacitation','target-invalid']);
const cleanId=(value,name)=>{if(typeof value!=='string'||!value||value.length>160)throw new TypeError(name+' required');return value;};
const phase=value=>PHASES.has(value)?value:null;
const samePair=(state,a,b)=>!state.pair?.length||(state.pair.includes(a)&&state.pair.includes(b));
export function createJohakyuExchangeState({sourceId=null,targetId=null}={}){
  if(sourceId!==null)cleanId(sourceId,'exchange source');if(targetId!==null)cleanId(targetId,'exchange target');
  if(sourceId&&sourceId===targetId)throw new Error('exchange actors must differ');
  return freeze({mode:'read',initiativeId:null,responderId:null,pair:freeze(sourceId&&targetId?[sourceId,targetId]:[]),serial:0,pressureCount:0,lastPhase:null,lastReason:'read',continuity:'reset',normalStarted:false,completedById:null,transition:null});
}
export function classifyJohakyuParry({authored=false,counter=false,phase:rawPhase='jo',impact=null,capable=true}={}){
  const p=phase(rawPhase),knock=Math.hypot(Number(impact?.knockback?.x)||0,Number(impact?.knockback?.z)||0),power=Math.max(0,Number(impact?.power)||0),kick=Math.abs(Number(impact?.sourceKick)||0);
  const strong=Boolean(capable&&(authored||(counter&&(p==='kyu'||impact?.heavy||power>=1.05||knock>=.18||kick>=.18))));
  return freeze({strength:strong?'strong':'weak',strong,phase:p,signals:freeze({authored:Boolean(authored),counter:Boolean(counter),capable:Boolean(capable),heavy:Boolean(impact?.heavy),power,knockback:knock,sourceKick:kick})});
}
/** Reads the existing impact/body result, never computes an impact or applies injury. */
export function isDeepJohakyuExchangeHit({damage=0,maxHp=1,impact=null,outcome=null,previousOutcome=null}={}){
  return Boolean(outcome?.incapacitated||(previousOutcome&&outcome?.compromised&&!previousOutcome.compromised)||(!impact?.guard&&impact?.heavy)||damage/Math.max(1,maxHp)>=.16);
}
function read(state,reason){return freeze({...state,mode:'read',initiativeId:null,responderId:null,lastPhase:null,lastReason:reason,continuity:'reset',normalStarted:false,completedById:null,transition:null});}
export function reduceJohakyuExchange(current,event={}){
  const state=current&&MODES.has(current.mode)?current:createJohakyuExchangeState();
  const type=String(event.type||''),sourceId=event.sourceId??state.initiativeId,targetId=event.targetId??state.responderId;
  if(event.exchangeSerial!=null&&event.exchangeSerial!==state.serial)return state;
  if(sourceId&&targetId){cleanId(sourceId,'exchange source');cleanId(targetId,'exchange target');if(sourceId===targetId)throw new Error('exchange actors must differ');if(!samePair(state,sourceId,targetId))return state;}
  if(type==='settle'){
    if(state.mode==='zanshin')return read(state,'zanshin-settled');
    // Completion of recoil/counter is NOT a new normal attack or a cursor write.
    if(state.mode==='reversal')return freeze({...state,transition:'ready',lastReason:'reversal-settled'});
    return state;
  }
  if(!sourceId||!targetId)return state;
  const p=phase(event.phase),owner=state.initiativeId===sourceId;
  if(['one','finisher'].includes(p)||event.projectile)return state;
  if(type==='commit'){
    if(state.mode==='zanshin')return state;
    if(event.counter)return reduceJohakyuExchange(state,{...event,type:'counter-start'});
    if(state.mode==='pressure'&&!owner)return freeze({...state,lastReason:'secondary-commit',continuity:'retain'});
    if(state.mode==='reversal'&&(!owner||state.transition==='counter'))return state;
    const continuing=state.mode==='pressure'&&owner&&state.normalStarted;
    if(!continuing&&NORMAL_PHASES.has(p)&&p!=='jo')return freeze({...state,lastReason:'normal-start-required'});
    if(!NORMAL_PHASES.has(p)&&p!=='enemy')return state;
    return freeze({...state,mode:'pressure',initiativeId:sourceId,responderId:targetId,pair:freeze([sourceId,targetId]),serial:continuing?state.serial:state.serial+1,pressureCount:continuing?state.pressureCount+1:1,lastPhase:p,lastReason:'commit',continuity:'pressure',normalStarted:true,completedById:null,transition:null});
  }
  if(type==='parry'&&event.strong){
    return freeze({...state,mode:'reversal',initiativeId:targetId,responderId:sourceId,pair:freeze([sourceId,targetId]),serial:state.serial+1,lastPhase:p,lastReason:'strong-parry',continuity:'reverse',normalStarted:false,completedById:null,transition:'recoil'});
  }
  if(type==='counter-start'||type==='counter-complete'){
    if(state.mode!=='reversal'||!owner)return state;
    return freeze({...state,transition:type==='counter-start'?'counter':'ready',lastReason:type,continuity:'reverse'});
  }
  if(FAILURE.has(type)){
    if(type==='disengage'||type==='incapacitation'||type==='target-invalid'||owner)return read(state,type);
    return state; // A blocked responder cannot cancel the owner's valid pressure.
  }
  if(type==='kyu-complete'){
    if(state.mode!=='pressure'||!owner||!state.normalStarted||p!=='kyu'||event.counter)return state;
    return freeze({...state,mode:'zanshin',lastPhase:'kyu',lastReason:type,continuity:'reset',normalStarted:false,completedById:sourceId,transition:null});
  }
  if(type==='hit'&&event.deep){
    // A counter impact remains part of reversal until its executor finishes.
    if(state.mode==='reversal'&&owner&&event.counter)return state;
    return read(state,'deep-hit');
  }
  if(type==='miss'&&event.major){if(owner)return read(state,'major-miss');return state;}
  if(RETAIN.has(type)||type==='parry'||type==='hit'||type==='miss'){
    // Late guard/hit callbacks after an interruption cannot resurrect pressure.
    if(state.mode!=='pressure')return state;
    return freeze({...state,lastPhase:owner?(p??state.lastPhase):state.lastPhase,lastReason:type,continuity:'retain'});
  }
  return state;
}
export function johakyuExchangeSnapshot(state){
  const row=state&&MODES.has(state.mode)?state:createJohakyuExchangeState();
  return freeze({...row,pair:freeze([...(row.pair||[])])});
}
/** Projection only. The executing actor's canonical slot remains untouched. */
export function johakyuExchangeHudState(state,{actorId,phase:canonicalPhase=null,reaction=false,counter=false}={}){
  if(!state||reaction||counter)return'maai';
  if(state.mode==='zanshin')return state.completedById===actorId&&state.lastReason==='kyu-complete'?'zanshin':'maai';
  return state.mode==='pressure'&&state.normalStarted&&state.initiativeId===actorId&&NORMAL_PHASES.has(canonicalPhase)?canonicalPhase:'maai';
}
