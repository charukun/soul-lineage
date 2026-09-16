import {digest} from './canon-nucleus.js';

const clone=value=>structuredClone(value);
export const HANDOFF_PHASE=Object.freeze({SOURCE_OPEN:'source-open',PREPARED:'prepared',FENCED:'fenced',TARGET_OPEN:'target-open',CLOSED:'closed'});

export function createPolicyHandoff({sourcePolicy='crdt',targetPolicy='canon-nucleus',initialState={value:0},generation=1,allowUnsafeProof=false}={}){
  if(!Number.isInteger(generation)||generation<1)throw Error('Invalid handoff generation');
  let phase=HANDOFF_PHASE.SOURCE_OPEN,sourceOpen=true,targetOpen=false,sourceGeneration=generation,targetGeneration=generation+1,sourceState=clone(initialState),targetState=null,prepared=null,fence=null,rejectedOld=0,acceptedSource=0,acceptedTarget=0,crashedSource=false,crashedTarget=false;
  const history=[];
  function writeSource(mutator,{expectedGeneration=sourceGeneration}={}){
    if(expectedGeneration!==sourceGeneration||!sourceOpen||crashedSource){rejectedOld++;return false;}sourceState=mutator(clone(sourceState));acceptedSource++;history.push({side:'source',generation:sourceGeneration,state:clone(sourceState)});return true;
  }
  function prepare(){
    if(!sourceOpen||crashedSource||targetOpen)throw Error('Source policy is not available for handoff');
    const state=clone(sourceState),root=digest({sourcePolicy,targetPolicy,sourceGeneration,targetGeneration,state});prepared=Object.freeze({sourcePolicy,targetPolicy,sourceGeneration,targetGeneration,state,root});phase=HANDOFF_PHASE.PREPARED;return clone(prepared);
  }
  function persistFence(){
    if(!prepared||!sourceOpen||crashedSource)throw Error('Prepared handoff is unavailable');sourceOpen=false;fence=Object.freeze({...clone(prepared),fenced:true,fenceRoot:digest({handoffRoot:prepared.root,fenced:true})});phase=HANDOFF_PHASE.FENCED;history.push({side:'fence',generation:sourceGeneration,state:clone(fence.state)});return clone(fence);
  }
  function activate(){
    if(!fence||sourceOpen||crashedTarget)throw Error('Durable fence required before target activation');targetState=clone(fence.state);targetOpen=true;phase=HANDOFF_PHASE.TARGET_OPEN;history.push({side:'target-open',generation:targetGeneration,state:clone(targetState)});return true;
  }
  function writeTarget(mutator,{expectedGeneration=targetGeneration}={}){
    if(expectedGeneration!==targetGeneration||!targetOpen||crashedTarget){rejectedOld++;return false;}targetState=mutator(clone(targetState));acceptedTarget++;history.push({side:'target',generation:targetGeneration,state:clone(targetState)});return true;
  }
  function crash(side){
    if(side==='source'){crashedSource=true;sourceOpen=false;if(!fence&&!targetOpen)phase=HANDOFF_PHASE.CLOSED;}
    else if(side==='target'){crashedTarget=true;targetOpen=false;if(sourceOpen)phase=prepared?HANDOFF_PHASE.PREPARED:HANDOFF_PHASE.SOURCE_OPEN;else phase=HANDOFF_PHASE.CLOSED;}
    else throw Error('Unknown handoff side');return snapshot();
  }
  function unsafeActivateBeforeFence(){
    if(!allowUnsafeProof)throw Error('Unsafe proof path disabled');if(!prepared)prepare();targetState=clone(prepared.state);targetOpen=true;phase=HANDOFF_PHASE.TARGET_OPEN;return true;
  }
  function safety(){
    const noOverlap=!(sourceOpen&&targetOpen),targetRequiresFence=!targetOpen||Boolean(fence),baseMatchesFence=!targetOpen||digest(targetState)===digest(fence?.state)||acceptedTarget>0;
    const fenceMatchesPrepared=!fence||fence.root===prepared?.root;
    return{pass:noOverlap&&targetRequiresFence&&baseMatchesFence&&fenceMatchesPrepared,noOverlap,targetRequiresFence,baseMatchesFence,fenceMatchesPrepared};
  }
  function snapshot(){return Object.freeze({phase,sourcePolicy,targetPolicy,sourceGeneration,targetGeneration,sourceOpen,targetOpen,sourceState:clone(sourceState),targetState:clone(targetState),prepared:clone(prepared),fence:clone(fence),rejectedOld,acceptedSource,acceptedTarget,crashedSource,crashedTarget,history:clone(history),safety:safety()});}
  return{writeSource,prepare,persistFence,activate,writeTarget,crash,unsafeActivateBeforeFence,snapshot,safety};
}

export function proveFencedPolicyHandoff(){
  const stages=['source-open','prepared','fenced','target-open'],crashes=['none','source','target'],cases=[];
  for(const stage of stages)for(const failed of crashes){
    const handoff=createPolicyHandoff({initialState:{value:1}});handoff.writeSource(state=>({...state,value:state.value+1}));
    if(stage!=='source-open')handoff.prepare();if(['fenced','target-open'].includes(stage))handoff.persistFence();if(stage==='target-open')handoff.activate();if(failed!=='none')handoff.crash(failed);
    const before=handoff.snapshot(),lateAccepted=handoff.writeSource(state=>({...state,value:999}),{expectedGeneration:1}),after=handoff.snapshot();
    const targetSafe=stage!=='target-open'||failed==='target'||after.targetState?.value===2;
    cases.push({stage,failed,lateAccepted,phase:after.phase,targetSafe,safety:after.safety,pass:after.safety.pass&&targetSafe&&(before.sourceOpen?lateAccepted===!before.crashedSource:lateAccepted===false)});
  }
  const sourceCrashAfterFence=createPolicyHandoff({initialState:{value:7}});sourceCrashAfterFence.prepare();sourceCrashAfterFence.persistFence();sourceCrashAfterFence.crash('source');const canActivateAfterSourceCrash=sourceCrashAfterFence.activate(),recovered=sourceCrashAfterFence.snapshot();
  return{pass:cases.every(row=>row.pass)&&canActivateAfterSourceCrash&&recovered.targetOpen&&recovered.targetState.value===7,cases,canActivateAfterSourceCrash,recovered};
}

export function proveSequentialPolicyEpochs(){
  const first=createPolicyHandoff({sourcePolicy:'crdt',targetPolicy:'snapshot-authority',initialState:{value:0},generation:1});first.writeSource(state=>({...state,value:1}));first.prepare();first.persistFence();first.activate();first.writeTarget(state=>({...state,value:2}),{expectedGeneration:2});const firstDone=first.snapshot();
  const second=createPolicyHandoff({sourcePolicy:'snapshot-authority',targetPolicy:'canon-nucleus',initialState:firstDone.targetState,generation:2});second.prepare();second.persistFence();second.activate();const staleGen1=second.writeTarget(state=>({...state,value:999}),{expectedGeneration:1}),staleGen2Source=second.writeSource(state=>({...state,value:999}),{expectedGeneration:2});second.writeTarget(state=>({...state,value:3}),{expectedGeneration:3});const final=second.snapshot();
  return{pass:firstDone.safety.pass&&final.safety.pass&&staleGen1===false&&staleGen2Source===false&&final.targetState.value===3&&final.targetGeneration===3,first:firstDone,final,staleGen1,staleGen2Source};
}

export function proveUnsafeDirectPolicySwitchCounterexample(){
  const handoff=createPolicyHandoff({initialState:{value:0},allowUnsafeProof:true});handoff.writeSource(state=>({...state,value:1}));handoff.prepare();handoff.unsafeActivateBeforeFence();const targetBefore=handoff.snapshot().targetState.value;handoff.writeSource(state=>({...state,value:2}),{expectedGeneration:1});handoff.writeTarget(state=>({...state,value:10}),{expectedGeneration:2});const snap=handoff.snapshot();
  return{pass:snap.safety.pass===false&&snap.sourceOpen&&snap.targetOpen&&snap.sourceState.value!==snap.targetState.value,targetBefore,snapshot:snap,counterexample:'activating the new policy before fencing the old generation permits divergent accepted writes'};
}

export function runPolicyHandoffProofSuite(){
  const fenced=proveFencedPolicyHandoff(),epochs=proveSequentialPolicyEpochs(),unsafe=proveUnsafeDirectPolicySwitchCounterexample();return{pass:fenced.pass&&epochs.pass&&unsafe.pass,fenced,epochs,unsafe,limits:['handoff proof preserves a declared state snapshot/root; translating richer policy-specific metadata still requires an adapter proof','the fence may sacrifice availability during transition; it does not claim zero-stall policy switching','external side effects still require their external ordering/commit contract before a local policy handoff may represent them']};
}
