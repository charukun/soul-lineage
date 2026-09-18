const clone=value=>structuredClone(value);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const canonical=value=>JSON.stringify(stable(value));
const same=(a,b)=>canonical(a)===canonical(b);
const fail=message=>{throw Error(`semantic shadow: ${message}`);};
const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;

function worldOf(checkpoint){
  const world=checkpoint?.world??checkpoint;
  if(!world||typeof world.worldId!=='string'||typeof world.ownerId!=='string'||!world.players||typeof world.players!=='object')fail('invalid checkpoint');
  if(!Number.isSafeInteger(world.epoch)||world.epoch<1)fail('invalid epoch');
  return world;
}
function lifeIdentity(life){
  return {id:life.id,name:life.name,seed:life.seed,generation:life.generation,birthVillageId:life.birthVillageId,lineage:clone(life.lineage??[])};
}
function recoveryBase(life){const out=clone(life);out.lineage=[];return out;}
const timed=(action,world)=>({...action,worldTick:Number.isSafeInteger(world.tick)?world.tick:0,worldSeconds:Number.isFinite(world.worldSeconds)?world.worldSeconds:0});
function lineageRecord(life){
  return {generation:life.generation,name:life.name,age:Math.floor(life.ageYears),birthVillageId:life.birthVillageId,
    returnedHome:Number(life.returns)>0,memento:null,defeats:life.defeats,equipment:clone(life.equipment),
    experiences:clone(life.experiences),skills:[...(life.knownSkills??[])]};
}
function terminalLife(life){
  return {...lifeIdentity(life),homelands:[...(life.homelands??[])],ended:Boolean(life.ended),phase:life.phase,
    ageSeconds:life.ageSeconds,ageYears:life.ageYears,returns:life.returns,defeats:life.defeats,
    equipment:clone(life.equipment),experiences:clone(life.experiences),knownSkills:[...(life.knownSkills??[])]};
}
function validateIdentity(life){
  if(!life||typeof life.id!=='string'||!Number.isSafeInteger(life.generation)||life.generation<1||!Array.isArray(life.lineage))fail('invalid life identity');
}
function historyEffect(type){return type==='birth'||type==='life-seal'||type==='rebirth';}

export function deriveSemanticShadowActions(previousCheckpoint,nextCheckpoint,{lifeSeconds}={}){
  if(!Number.isFinite(lifeSeconds)||lifeSeconds<=0)fail('lifeSeconds is required');
  const before=worldOf(previousCheckpoint),after=worldOf(nextCheckpoint);
  if(before.worldId!==after.worldId||before.ownerId!==after.ownerId)fail('world identity changed');
  if(after.epoch<before.epoch||after.epoch>before.epoch+1)fail('invalid epoch transition');
  const actions=[];
  if(after.epoch===before.epoch+1)actions.push(timed({type:'epoch-acquire',fromEpoch:before.epoch,toEpoch:after.epoch},after));
  for(const id of Object.keys(before.players))if(!Object.hasOwn(after.players,id))fail('committed player disappeared');
  for(const id of Object.keys(after.players).sort()){
    const next=after.players[id]?.life;validateIdentity(next);
    if(next.ended?next.phase!=='ended':next.ageSeconds>=lifeSeconds)fail('terminal rule mismatch');
    const prior=before.players[id]?.life;
    if(!prior){
      if(next.generation!==1||next.lineage.length!==0||next.ended)fail('unsupported birth checkpoint');
      const token=after.players[id]?.token;if(typeof token!=='string')fail('birth recovery token missing');
      actions.push(timed({type:'birth',playerId:id,life:lifeIdentity(next),recoveryBase:recoveryBase(next),token},after));continue;
    }
    validateIdentity(prior);
    if(prior.id===next.id){
      if(prior.generation!==next.generation||!same(lifeIdentity(prior),lifeIdentity(next)))fail('protected life identity changed in place');
      if(prior.ended&&!next.ended)fail('sealed life resurrected');
      if(prior.ended&&next.ended&&!same(terminalLife(prior),terminalLife(next)))fail('sealed life changed');
      if(!prior.ended&&next.ended)actions.push(timed({type:'life-seal',playerId:id,lifeId:next.id,terminal:terminalLife(next),record:lineageRecord(next)},after));
      continue;
    }
    if(!prior.ended)fail('rebirth predecessor not sealed');
    if(next.generation!==prior.generation+1)fail('rebirth generation mismatch');
    const record=lineageRecord(prior), expectedLineage=[...prior.lineage,record];
    if(!same(next.lineage,expectedLineage))fail('rebirth lineage mismatch');
    const intent=after.rebirthOps?.[prior.id];
    if(!intent||intent.playerId!==id||intent.lifeId!==prior.id||intent.resultId!==next.id)fail('rebirth operation missing');
    actions.push(timed({type:'rebirth',playerId:id,previousLifeId:prior.id,resultLifeId:next.id,intent:clone(intent),life:lifeIdentity(next),recoveryBase:recoveryBase(next)},after));
  }
  return actions;
}

function baseline(world){
  return {worldId:world.worldId,ownerId:world.ownerId,epoch:world.epoch,protectedTick:Number.isSafeInteger(world.tick)?world.tick:0,
    protectedWorldSeconds:Number.isFinite(world.worldSeconds)?world.worldSeconds:0,
    players:Object.fromEntries(Object.entries(world.players).map(([id,row])=>[id,{identity:lifeIdentity(row.life),recoveryBase:recoveryBase(row.life),token:row.token??null,
      sealed:Boolean(row.life.ended),terminal:row.life.ended?terminalLife(row.life):null}])),
    rebirthOps:clone(world.rebirthOps??{})};
}
function checkpointFromState(state){
  return {world:{worldId:state.worldId,ownerId:state.ownerId,epoch:state.epoch,
    tick:state.protectedTick??0,worldSeconds:state.protectedWorldSeconds??0,
    players:Object.fromEntries(Object.entries(state.players).map(([id,row])=>[id,{token:row.token,life:row.sealed?clone(row.terminal):{...clone(row.identity),ended:false}}])),
    rebirthOps:clone(state.rebirthOps??{})}};
}
export function validateSemanticShadowRestore(raw,{worldId,ownerId,authorityRoot,historySequence}={}){
  if(!raw||raw.format!==1||raw.worldId!==worldId||raw.ownerId!==ownerId||raw.authorityRoot!==authorityRoot||
      raw.lastHistorySequence!==historySequence||!raw.state||raw.state.worldId!==worldId||raw.state.ownerId!==ownerId)fail('coverage anchor mismatch');
  if(!Number.isSafeInteger(raw.state.epoch)||raw.state.epoch<1||!raw.state.players||typeof raw.state.players!=='object')fail('invalid restored state');
  if(!Number.isSafeInteger(raw.state.protectedTick)||raw.state.protectedTick<0||!Number.isFinite(raw.state.protectedWorldSeconds)||raw.state.protectedWorldSeconds<0)fail('invalid restored time');
  for(const row of Object.values(raw.state.players))if(!row||!row.identity||!row.recoveryBase||typeof row.token!=='string')fail('invalid restored player');
  return clone(raw);
}
function apply(state,action){
  state.protectedTick=Math.max(state.protectedTick??0,Number.isSafeInteger(action.worldTick)?action.worldTick:0);state.protectedWorldSeconds=Math.max(state.protectedWorldSeconds??0,Number.isFinite(action.worldSeconds)?action.worldSeconds:0);
  if(action.type==='epoch-acquire'){if(action.fromEpoch!==state.epoch)fail('epoch base mismatch');state.epoch=action.toEpoch;return;}
  if(action.type==='birth'){
    if(state.players[action.playerId])fail('duplicate birth');
    state.players[action.playerId]={identity:clone(action.life),recoveryBase:clone(action.recoveryBase),token:action.token,sealed:false,terminal:null};return;
  }
  const row=state.players[action.playerId];if(!row)fail('missing shadow player');
  if(action.type==='life-seal'){
    if(row.sealed||row.identity.id!==action.lifeId)fail('invalid shadow seal');
    row.sealed=true;row.terminal=clone(action.terminal);return;
  }
  if(action.type==='rebirth'){
    if(!row.sealed||row.identity.id!==action.previousLifeId)fail('invalid shadow rebirth predecessor');
    state.rebirthOps[action.previousLifeId]=clone(action.intent);
    row.identity=clone(action.life);row.recoveryBase=clone(action.recoveryBase);row.sealed=false;row.terminal=null;return;
  }
  fail('unknown action');
}
function compareState(state,world){
  if(state.worldId!==world.worldId||state.ownerId!==world.ownerId||state.epoch!==world.epoch)fail('world projection mismatch');
  if(!same(Object.keys(state.players).sort(),Object.keys(world.players).sort()))fail('player set mismatch');
  for(const [id,row] of Object.entries(state.players)){
    const life=world.players[id]?.life;validateIdentity(life);
    if(!same(row.identity,lifeIdentity(life)))fail(`identity mismatch for ${id}`);
    if(typeof row.token==='string'&&row.token!==world.players[id]?.token)fail(`recovery token mismatch for ${id}`);
    if(row.sealed){
      if(!life.ended||!same(row.terminal,terminalLife(life)))fail(`terminal mismatch for ${id}`);
    }
  }
  if(!same(state.rebirthOps,world.rebirthOps??{}))fail('rebirth receipt mismatch');
}

export function recoverCheckpointWithSemanticShadow(provisional,shadowExport){
  if(!provisional||!shadowExport?.state)fail('recovery inputs missing');
  const out=clone(provisional),world=worldOf(out),state=shadowExport.state;
  if(world.worldId!==state.worldId||world.ownerId!==state.ownerId)fail('recovery world mismatch');
  world.epoch=state.epoch;world.tick=Math.max(Number.isSafeInteger(world.tick)?world.tick:0,state.protectedTick??0);
  world.worldSeconds=Math.max(Number.isFinite(world.worldSeconds)?world.worldSeconds:0,state.protectedWorldSeconds??0);
  const players={};
  for(const [id,row] of Object.entries(state.players)){
    const existing=world.players[id];let life;
    if(existing?.life?.id===row.identity.id&&!row.sealed)life={...clone(existing.life),...clone(row.identity),lineage:clone(row.identity.lineage)};
    else{life=clone(row.recoveryBase);Object.assign(life,clone(row.identity));life.lineage=clone(row.identity.lineage);}
    if(row.sealed)Object.assign(life,clone(row.terminal));
    players[id]={...(existing?clone(existing):{portDwell:0}),token:row.token,life};
  }
  world.players=players;world.rebirthOps=clone(state.rebirthOps??{});return out;
}

export function createSemanticShadow({lifeSeconds,onSample=null,onState=null,onCommit=null,restored=null,coverageHint='warm-start'}={}){
  let state=restored?clone(restored.state):null,lastCheckpoint=null,lastHistorySequence=restored?.lastHistorySequence??null,commits=restored?.commits??0,failure=null;
  let checkpointBytesTotal=restored?.checkpointBytesTotal??0,journalBytesTotal=restored?.journalBytesTotal??0,lastSample=null;
  let authorityRoot=restored?.authorityRoot??null,journalCount=restored?.journalCount??0,recentJournalTypes=[...(restored?.recentJournalTypes??[])].slice(-32);
  const journal=[];
  if(!['warm-start','gap'].includes(coverageHint))fail('invalid coverage hint');
  const coverage=restored?'restored':coverageHint;
  const commitLatency=receipt=>Number.isFinite(Number(receipt?.commitLatencyMs))?Number(receipt.commitLatencyMs):null;
  const sample=value=>{const{checkpointPayload,journalPayload,...publicSample}=value;lastSample=clone(publicSample);checkpointBytesTotal+=publicSample.checkpointBytes;journalBytesTotal+=publicSample.journalBytes;try{onSample?.({...clone(publicSample),checkpointPayload:clone(checkpointPayload),journalPayload:clone(journalPayload)});}catch{/* measurement sinks never affect shadow semantics */}};
  const exportState=()=>({format:1,worldId:state?.worldId??null,ownerId:state?.ownerId??null,authorityRoot,lastHistorySequence,commits,
    checkpointBytesTotal,journalBytesTotal,journalCount:journalCount+journal.length,recentJournalTypes:[...recentJournalTypes,...journal.map(row=>row.type)].slice(-32),state:clone(state)});
  const publishState=context=>{const exported=exportState();try{onState?.(exported);}catch{/* diagnostic persistence never affects authoritative saves */}\n    try{onCommit?.({semanticState:clone(exported),checkpoint:clone(context.checkpoint),events:clone(context.events),receipt:clone(context.receipt)});}catch{/* semantic persistence sinks never affect authoritative saves */}};
  function observe(previousCheckpoint,nextCheckpoint,receipt={}){
    if(failure)throw failure;
    try{
      const nextWorld=worldOf(nextCheckpoint),historySequence=receipt.historySequence;
      if(!Number.isSafeInteger(historySequence)||historySequence<0)fail('history sequence missing');
      if(!state){
        state=baseline(nextWorld);lastCheckpoint=clone(nextCheckpoint);lastHistorySequence=historySequence;commits=1;authorityRoot=receipt.root??null;
        sample({checkpointBytes:byteLength(nextCheckpoint),journalBytes:0,eventCount:0,historyEffects:0,warmStart:true,commitLatencyMs:commitLatency(receipt),checkpointPayload:nextCheckpoint,journalPayload:[]});publishState({checkpoint:nextCheckpoint,events:[],receipt});
        return snapshot();
      }
      let comparisonCheckpoint=previousCheckpoint;
      if(lastCheckpoint){
        if(!previousCheckpoint||!same(worldOf(previousCheckpoint),worldOf(lastCheckpoint)))fail('writer/shadow commit order diverged');
      }else comparisonCheckpoint=checkpointFromState(state);
      const actions=deriveSemanticShadowActions(comparisonCheckpoint,nextCheckpoint,{lifeSeconds});
      const expectedHistoryDelta=actions.filter(action=>historyEffect(action.type)).length;
      if(historySequence-lastHistorySequence!==expectedHistoryDelta)fail('history sequence does not match semantic effects');
      for(const action of actions){apply(state,action);journal.push({...clone(action),commitRevision:receipt.revision??null});}
      compareState(state,nextWorld);
      lastCheckpoint=clone(nextCheckpoint);lastHistorySequence=historySequence;commits++;authorityRoot=receipt.root??null;
      sample({checkpointBytes:byteLength(nextCheckpoint),journalBytes:actions.reduce((n,action)=>n+byteLength(action),0),
        eventCount:actions.length,historyEffects:expectedHistoryDelta,warmStart:false,commitLatencyMs:commitLatency(receipt),checkpointPayload:nextCheckpoint,journalPayload:actions});publishState({checkpoint:nextCheckpoint,events:actions,receipt});
      return snapshot();
    }catch(error){failure=error instanceof Error?error:Error(String(error));throw failure;}
  }
  function snapshot(){return {status:failure?'diverged':state?'tracking':'cold',coverage,commits,lastHistorySequence,
    journalLength:journalCount+journal.length,journalTypes:[...recentJournalTypes,...journal.map(row=>row.type)].slice(-32),epoch:state?.epoch??null,
    playerCount:state?Object.keys(state.players).length:0,checkpointBytesTotal,journalBytesTotal,lastSample:clone(lastSample),
    authorityRoot,error:failure?.message??null};}
  return {observe,snapshot,exportState,get failure(){return failure;},get journal(){return clone(journal);}};
}
