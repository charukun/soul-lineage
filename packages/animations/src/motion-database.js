import {buildPoseCandidateBank} from './motion-operationalization.js';
import {rankPoseCandidates} from './motion-orchestration.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const freeze=value=>Object.freeze(value);
const finite=(...values)=>values.every(Number.isFinite);
const speedBand=speed=>speed<.15?'idle':speed<2?'walk':'run';
const point=value=>Array.isArray(value)?{x:Number(value[0])||0,y:Number(value[1])||0,z:Number(value[2])||0}:value&&typeof value==='object'?{x:Number(value.x)||0,y:Number(value.y)||0,z:Number(value.z)||0}:null;
const transitionKey=(from,to)=>`${from||'*'}->${to||'*'}`;

export const MOTION_DATABASE_VERSION=1;
export const MOTION_TRANSITION_STATES=freeze(['idle','move','stop','pivot','attack','recovery','hit']);

function sampleFeature(clip,key,phase){
 const source=clip?.[key];
 if(typeof source==='function')return point(source(phase));
 if(Array.isArray(source)&&source.length){
  const index=Math.min(source.length-1,Math.round(clamp(phase)*(source.length-1)));
  return point(source[index]);
 }
 return point(source);
}
function semanticNames(clip,phase){
 const events=clip?.semanticTimeline?.events??clip?.semanticEvents??[];
 if(!Array.isArray(events))return freeze([]);
 return freeze(events.filter(event=>event&&typeof event.name==='string'&&(!Number.isFinite(event.phase)||Math.abs(event.phase-phase)<=.18)).map(event=>event.name).sort());
}
function defaultTransitions(state){
 if(state==='idle')return['idle->move','move->idle','stop->idle'];
 if(state==='move')return['idle->move','move->move','move->stop','move->pivot','recovery->move'];
 if(state==='attack')return['move->attack','idle->attack'];
 if(state==='recovery')return['attack->recovery','hit->recovery'];
 return[];
}
function addBucket(target,key,index){(target[key]??=[]).push(index);}

export function buildMotionDatabase({clips=[],fps=60,samplesPerClip=7,revision='motion-db'}={}){
 if(typeof revision!=='string'||!revision||!Array.isArray(clips)||!clips.length)throw Error('Invalid motion database input');
 const bank=buildPoseCandidateBank({clips,fps,samplesPerClip}),byClip=new Map(clips.map(clip=>[String(clip.id),clip])),records=[],buckets={};
 for(const candidate of bank.candidates){
  const clip=byClip.get(candidate.clipId);if(!clip)throw Error('Motion database clip missing');
  const transitions=freeze([...(Array.isArray(clip.transitions)&&clip.transitions.length?clip.transitions:defaultTransitions(candidate.state))].map(String).sort());
  const record=freeze({...candidate,speedBand:speedBand(candidate.speed),transitions,semanticEvents:semanticNames(clip,candidate.phase),root:sampleFeature(clip,'rootAt',candidate.phase),centerOfMass:sampleFeature(clip,'centerOfMassAt',candidate.phase),weaponTip:sampleFeature(clip,'weaponTipAt',candidate.phase)});
  const index=records.length;records.push(record);
  for(const key of [`${record.state}|${record.supportSide}|${record.speedBand}`,`${record.state}|*|${record.speedBand}`,`${record.state}|${record.supportSide}|*`,`${record.state}|*|*`])addBucket(buckets,key,index);
  for(const transition of transitions)addBucket(buckets,`transition:${transition}`,index);
  for(const event of record.semanticEvents)addBucket(buckets,`event:${event}`,index);
 }
 const frozenBuckets=Object.fromEntries(Object.entries(buckets).map(([key,indices])=>[key,freeze([...new Set(indices)])]));
 return freeze({schema:'motion-feature-database',version:MOTION_DATABASE_VERSION,revision,fps,records:freeze(records),buckets:freeze(frozenBuckets),advisory:true,gameplayAuthority:false,contactTimingAuthority:'gameplay-external'});
}

export function validateMotionDatabase(database){
 if(!database||database.schema!=='motion-feature-database'||database.version!==MOTION_DATABASE_VERSION||typeof database.revision!=='string'||!Number.isSafeInteger(database.fps)||database.fps<=0||!Array.isArray(database.records)||!database.records.length||!database.buckets||typeof database.buckets!=='object'||database.gameplayAuthority!==false)return false;
 return database.records.every(row=>row&&typeof row.id==='string'&&typeof row.clipId==='string'&&typeof row.state==='string'&&finite(row.phase,row.speed,row.yaw,row.continuity)&&['left','right'].includes(row.supportSide)&&Array.isArray(row.transitions)&&Array.isArray(row.semanticEvents));
}

function candidateIndices(database,{state,supportSide,speed,transition,requiredEvent}){
 const band=speedBand(Math.max(0,Number(speed)||0)),keys=[];
 if(transition)keys.push(`transition:${transition}`);
 if(requiredEvent)keys.push(`event:${requiredEvent}`);
 if(state)keys.push(`${state}|${supportSide==='right'?'right':'left'}|${band}`,`${state}|*|${band}`,`${state}|*|*`);
 let result=null;
 for(const key of keys){const values=database.buckets[key];if(!values?.length)continue;const set=new Set(values);result=result===null?set:new Set([...result].filter(index=>set.has(index)));if(result.size)break;}
 return result?.size?[...result]:database.records.map((_,index)=>index);
}

export function queryMotionDatabase({database,state,speed=0,yaw=0,supportSide='left',trajectory=[],transition=null,requiredEvent=null,previousClipId=null,limit=5}={}){
 if(!validateMotionDatabase(database)||!Number.isSafeInteger(limit)||limit<1||limit>12)throw Error('Invalid motion database query');
 const indices=candidateIndices(database,{state,supportSide,speed,transition,requiredEvent}),candidates=indices.map(index=>database.records[index]).filter(row=>(!state||row.state===state)&&(!transition||row.transitions.includes(transition))&&(!requiredEvent||row.semanticEvents.includes(requiredEvent)));
 const pool=candidates.length?candidates:indices.map(index=>database.records[index]).filter(row=>!state||row.state===state);
 if(!pool.length)return freeze({schema:'motion-database-query',version:1,winner:null,ranked:freeze([]),advisory:true,gameplayAuthority:false});
 const ranked=rankPoseCandidates({query:{state,speed,yaw,supportSide,trajectory},candidates:pool.map(row=>({...row,continuity:clamp(row.continuity+(previousClipId&&row.clipId===String(previousClipId)?.08:0))}))}).map(row=>{
  const transitionPenalty=transition&&!row.candidate.transitions.includes(transition)?.75:0,eventPenalty=requiredEvent&&!row.candidate.semanticEvents.includes(requiredEvent)?.9:0;
  return freeze({...row,score:row.score+transitionPenalty+eventPenalty,terms:freeze({...row.terms,transition:transitionPenalty,event:eventPenalty})});
 }).sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id));
 const top=freeze(ranked.slice(0,limit)),winner=top[0]??null;
 return freeze({schema:'motion-database-query',version:1,winner,winnerRecord:winner?.candidate??null,ranked:top,advisory:true,gameplayAuthority:false});
}

export function planMotionTransition({database,fromState='idle',toState='idle',speed=0,yaw=0,supportSide='left',trajectory=[],previousClipId=null,requiredEvent=null}={}){
 if(!MOTION_TRANSITION_STATES.includes(fromState)||!MOTION_TRANSITION_STATES.includes(toState))throw Error('Invalid motion transition states');
 const transition=transitionKey(fromState,toState),queryState=toState==='stop'||toState==='pivot'?'move':toState==='hit'?'recovery':toState,query=queryMotionDatabase({database,state:queryState,speed,yaw,supportSide,trajectory,transition,requiredEvent,previousClipId});
 const contactLocked=fromState==='attack'||toState==='attack',phaseAlign=!contactLocked&&['idle','move','stop','pivot'].includes(fromState)&&['idle','move','stop','pivot'].includes(toState),application=phaseAlign?'phase-align':'additive-bridge';
 return freeze({schema:'motion-transition-plan',version:1,transition,fromState,toState,application,phaseAlign,contactTimingLocked:contactLocked,selected:query.winnerRecord?freeze({id:query.winnerRecord.id,clipId:query.winnerRecord.clipId,phase:query.winnerRecord.phase,supportSide:query.winnerRecord.supportSide,score:query.winner.score}):null,ranked:query.ranked,gameplayAuthority:false});
}

export function transitionBridgePose(plan,{progress=.5,maxYaw=.10,maxPitch=.055}={}){
 if(!plan||plan.schema!=='motion-transition-plan'||plan.version!==1||!finite(progress,maxYaw,maxPitch)||maxYaw<0||maxPitch<0)throw Error('Invalid motion transition bridge');
 const envelope=Math.sin(Math.PI*clamp(progress)),score=Number(plan.selected?.score)||0,quality=1-clamp(score/4),side=plan.selected?.supportSide==='right'?-1:1,turn=clamp(side*(.025+.04*quality),-maxYaw,maxYaw)*envelope,pitch=clamp((plan.toState==='attack'?-.025:plan.fromState==='attack'?.018:0)*quality,-maxPitch,maxPitch)*envelope;
 return freeze({version:1,envelope,pelvisYaw:turn*.55,chestYaw:turn,pelvisPitch:pitch,chestPitch:-pitch*.45,supportSide:plan.selected?.supportSide??null,presentationOnly:true,contactTimingChanged:false,gameplayAuthority:false});
}
