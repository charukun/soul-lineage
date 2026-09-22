const freeze=Object.freeze;
const MODES=new Set(['read','pressure','reversal','zanshin']);
const PHASES=new Set(['jo','ha','kyu','uke','one','finisher','enemy']);
const cleanId=(value,name)=>{if(typeof value!=='string'||!value||value.length>160)throw new TypeError(name+' required');return value;};
const phase=value=>PHASES.has(value)?value:'jo';
const continuityFor=(type,strong=false,deep=false,major=false)=>{
  if(type==='guard')return'retain';
  if(type==='parry')return strong?'reverse':'retain';
  if(type==='hit')return deep?'reset':'retain';
  if(type==='miss')return major?'reset':'retain';
  if(type==='execution-blocked'||type==='kyu-complete'||type==='disengage')return'reset';
  return'pressure';
};
export function createJohakyuExchangeState({sourceId=null,targetId=null}={}){
  if(sourceId!==null)cleanId(sourceId,'exchange source');if(targetId!==null)cleanId(targetId,'exchange target');
  return freeze({mode:'read',initiativeId:null,responderId:null,pair:freeze(sourceId&&targetId?[sourceId,targetId]:[]),serial:0,pressureCount:0,lastPhase:null,lastReason:'read',continuity:'reset'});
}
export function classifyJohakyuParry({authored=false,counter=false,phase:rawPhase='jo',impact=null}={}){
  const p=phase(rawPhase),knock=Math.hypot(Number(impact?.knockback?.x)||0,Number(impact?.knockback?.z)||0),power=Math.max(0,Number(impact?.power)||0),kick=Math.abs(Number(impact?.sourceKick)||0);
  const strong=Boolean(authored||(counter&&(p==='kyu'||impact?.heavy||power>=1.05||knock>=.18||kick>=.18)));
  return freeze({strength:strong?'strong':'weak',strong,phase:p,signals:freeze({authored:Boolean(authored),counter:Boolean(counter),heavy:Boolean(impact?.heavy),power,knockback:knock,sourceKick:kick})});
}
export function reduceJohakyuExchange(current,event={}){
  const state=current&&MODES.has(current.mode)?current:createJohakyuExchangeState();
  const type=String(event.type||'commit'),sourceId=event.sourceId??state.initiativeId,targetId=event.targetId??state.responderId;
  if(type==='disengage')return createJohakyuExchangeState({sourceId:sourceId??null,targetId:targetId??null});
  if(type==='settle'){
    if(state.mode==='reversal'&&state.initiativeId&&state.responderId)return freeze({...state,mode:'pressure',pressureCount:state.pressureCount+1,lastReason:'reversal-settled',continuity:'pressure'});
    if(state.mode==='zanshin')return freeze({...state,mode:'read',initiativeId:null,responderId:null,lastReason:'zanshin-settled',continuity:'reset'});
    return state;
  }
  if(!sourceId||!targetId)return state;
  cleanId(sourceId,'exchange source');cleanId(targetId,'exchange target');if(sourceId===targetId)throw new Error('exchange actors must differ');
  const p=phase(event.phase),strong=Boolean(event.strong),deep=Boolean(event.deep),major=Boolean(event.major),continuity=continuityFor(type,strong,deep,major);
  if(type==='commit'){
    if(state.mode==='pressure'&&state.initiativeId&&state.initiativeId!==sourceId)return freeze({...state,lastPhase:p,lastReason:'secondary-commit',continuity:'retain'});
    const serial=state.mode==='read'||state.mode==='zanshin'||!state.initiativeId?state.serial+1:state.serial;
    return freeze({mode:'pressure',initiativeId:sourceId,responderId:targetId,pair:freeze([sourceId,targetId]),serial,pressureCount:state.pressureCount+1,lastPhase:p,lastReason:'commit',continuity:'pressure'});
  }
  if(type==='parry'&&strong){
    return freeze({mode:'reversal',initiativeId:targetId,responderId:sourceId,pair:freeze([sourceId,targetId]),serial:state.serial+1,pressureCount:state.pressureCount,lastPhase:p,lastReason:'strong-parry',continuity});
  }
  if((type==='hit'&&deep)||(type==='miss'&&major)||type==='execution-blocked'||type==='kyu-complete'){
    return freeze({mode:'zanshin',initiativeId:sourceId,responderId:targetId,pair:freeze([sourceId,targetId]),serial:state.serial,pressureCount:state.pressureCount,lastPhase:p,lastReason:type==='hit'?'deep-hit':type==='miss'?'major-miss':type,continuity});
  }
  return freeze({mode:'pressure',initiativeId:state.initiativeId??sourceId,responderId:state.responderId??targetId,pair:state.pair?.length?state.pair:freeze([sourceId,targetId]),serial:state.serial||1,pressureCount:state.pressureCount+1,lastPhase:p,lastReason:type,continuity});
}
export function johakyuExchangeSnapshot(state){
  const row=state&&MODES.has(state.mode)?state:createJohakyuExchangeState();
  return freeze({mode:row.mode,initiativeId:row.initiativeId,responderId:row.responderId,serial:row.serial,pressureCount:row.pressureCount,lastPhase:row.lastPhase,lastReason:row.lastReason,continuity:row.continuity});
}
