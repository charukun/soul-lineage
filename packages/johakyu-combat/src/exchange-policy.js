/** Melee meaning only. Execution, timing, contact, damage and cost remain authority events. */
const freeze=Object.freeze;
const MODES=new Set(['read','pressure','reversal','zanshin']);
const PHASES=new Set(['jo','ha','kyu','uke','mind','one','finisher','enemy']);
const cleanId=(value,name)=>{if(typeof value!=='string'||!value||value.length>160)throw new TypeError(name+' required');return value;};
const phase=value=>PHASES.has(value)?value:null;
const samePair=(pair,a,b)=>!pair?.length||(pair.includes(a)&&pair.includes(b));
const reset=(state,reason)=>freeze({...state,mode:'read',initiativeId:null,responderId:null,completedBy:null,pressureCount:0,lastPhase:null,lastReason:reason,continuity:'reset'});
export function createJohakyuExchangeState({sourceId=null,targetId=null}={}){
  if(sourceId!==null)cleanId(sourceId,'exchange source');if(targetId!==null)cleanId(targetId,'exchange target');
  if(sourceId&&sourceId===targetId)throw new Error('exchange actors must differ');
  return freeze({mode:'read',initiativeId:null,responderId:null,pair:freeze(sourceId&&targetId?[sourceId,targetId]:[]),serial:0,pressureCount:0,lastPhase:null,lastReason:'read',continuity:'reset',completedBy:null});
}
/** Called only for an actual defensive contact, not to invent a contact or its time. */
export function classifyJohakyuParry({authored=false,counter=false,phase:rawPhase='jo',impact=null,contact=true,capable=true,slip=false,responding=true}={}){
  const p=phase(rawPhase),knock=Math.hypot(Number(impact?.knockback?.x)||0,Number(impact?.knockback?.z)||0),power=Math.max(0,Number(impact?.power)||0),kick=Math.abs(Number(impact?.sourceKick)||0);
  const strong=Boolean(contact&&capable&&responding&&!slip&&(authored||(counter&&(p==='kyu'||impact?.heavy||power>=1.05||knock>=.18||kick>=.18))));
  return freeze({strength:strong?'strong':'weak',strong,phase:p,signals:freeze({authored:Boolean(authored),counter:Boolean(counter),contact:Boolean(contact),capable:Boolean(capable),slip:Boolean(slip),responding:Boolean(responding),heavy:Boolean(impact?.heavy),power,knockback:knock,sourceKick:kick})});
}
export function reduceJohakyuExchange(current,event={}){
  const state=current&&MODES.has(current.mode)?current:createJohakyuExchangeState();
  const type=String(event.type||'commit'),sourceId=event.sourceId??state.initiativeId,targetId=event.targetId??state.responderId;
  if(type==='settle')return state.mode==='zanshin'?reset(state,'zanshin-settled'):state;
  if(!sourceId||!targetId)return type==='disengage'?reset(state,type):state;
  cleanId(sourceId,'exchange source');cleanId(targetId,'exchange target');if(sourceId===targetId)throw new Error('exchange actors must differ');
  // A secondary opponent has its own pair. It never writes this pair's phase/owner.
  if(!samePair(state.pair,sourceId,targetId))return state;
  const p=phase(event.phase),pair=state.pair?.length?state.pair:freeze([sourceId,targetId]);
  if(['disengage','incapacitation','target-invalidation'].includes(type))return reset({...state,pair},type);
  // Old action/reaction cleanup must not complete, revive or advance a newer exchange.
  if(event.serial!=null&&event.serial!==state.serial)return state;
  if(type==='parry'&&event.strong){
    return freeze({...state,pair,mode:'reversal',initiativeId:targetId,responderId:sourceId,serial:state.serial+1,pressureCount:0,lastPhase:null,lastReason:'strong-parry',continuity:'reverse',completedBy:null});
  }
  if(type==='counter-start'||type==='counter-complete'){
    return state.mode==='reversal'&&state.initiativeId===sourceId?freeze({...state,lastReason:type,continuity:'retain'}):state;
  }
  if(type==='normal-start'){
    if(state.mode==='pressure')return state;
    if(state.mode==='reversal'&&state.initiativeId!==sourceId)return state;
    // The executor resets its cursor at the safe boundary BEFORE reporting normal-start.
    if(p!=='jo'&&p!=='enemy'&&!event.seeded)return state;
    return freeze({...state,pair,mode:'pressure',initiativeId:sourceId,responderId:targetId,serial:state.serial+1,pressureCount:0,lastPhase:p,lastReason:type,continuity:'pressure',completedBy:null});
  }
  if(type==='commit'||type==='stage'){
    // Backward-compatible first jo; reversal can ONLY leave through normal-start.
    if(type==='commit'&&state.mode==='read'&&(p==='jo'||p==='enemy'))return reduceJohakyuExchange(reduceJohakyuExchange(state,{...event,type:'normal-start'}),{...event,serial:undefined});
    if(state.mode!=='pressure'||state.initiativeId!==sourceId||!['jo','ha','kyu','enemy'].includes(p))return state;
    return freeze({...state,pressureCount:state.pressureCount+(type==='commit'?1:0),lastPhase:p,lastReason:type,continuity:'pressure'});
  }
  if((type==='hit'&&event.deep)||(type==='miss'&&event.major)){
    if(state.mode!=='pressure'||(type==='miss'&&state.initiativeId!==sourceId))return state;
    return reset(state,type==='hit'?'deep-hit':'major-miss');
  }
  if(['execution-blocked','capability-failure','interrupted'].includes(type)){
    return state.initiativeId===sourceId?reset(state,type):state;
  }
  if(type==='kyu-complete'||type==='offense-complete'){
    if(state.mode!=='pressure'||state.initiativeId!==sourceId||(type==='kyu-complete'&&(p!=='kyu'||state.lastPhase!=='kyu')))return state;
    return freeze({...state,mode:'zanshin',completedBy:sourceId,lastReason:type,continuity:'reset'});
  }
  if(['guard','parry','slip','deflection','hit','miss'].includes(type)&&state.mode==='pressure'){
    return freeze({...state,lastReason:type,continuity:'retain'});
  }
  return state;
}
export function johakyuExchangeSnapshot(state){
  const row=state&&MODES.has(state.mode)?state:createJohakyuExchangeState();
  return freeze({...row,pair:freeze([...(row.pair||[])])});
}
/** Canonical slot remains truth; ownership and transition gate its visibility. */
export function johakyuExchangeHudState(state,{actorId='hero',phase:slot=null,reaction=false}={}){
  if(reaction)return'maai';
  if(state?.mode==='zanshin'&&state.completedBy===actorId)return'zanshin';
  if(state?.mode!=='pressure'||state.initiativeId!==actorId)return'maai';
  const p=slot??state.lastPhase;
  return ['jo','ha','kyu'].includes(p)?p:'maai';
}
