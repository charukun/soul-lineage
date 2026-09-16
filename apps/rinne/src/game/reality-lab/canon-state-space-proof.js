import {PACKET_PHASE,PACKET_TYPE,createCanonPacketProtocol} from './canon-packet-proof.js';

const members=['n0','n1','n2'];
const actionKey=action=>JSON.stringify(action);

function fresh(){const protocol=createCanonPacketProtocol({failures:1,members,leaderId:'n0'});protocol.begin({operationId:'state-space:1',canon:{ended:true},recovery:{tick:42}});return protocol;}
function apply(protocol,action){
  if(action.kind==='deliver')return protocol.deliverSerial(action.serial);
  if(action.kind==='drop')return protocol.dropWhere(row=>row.serial===action.serial);
  if(action.kind==='crash'){protocol.crash(action.member);return true;}
  if(action.kind==='recover')return protocol.recover({candidateId:action.member});
  if(action.kind==='publish'){protocol.publish();return true;}
  throw Error('Unknown state-space action');
}
function replay(trace){
  const protocol=fresh();for(const action of trace)apply(protocol,action);return protocol;
}
function ackHistory(trace){return trace.filter(row=>row.kind==='deliver'&&row.type===PACKET_TYPE.ACK).map(row=>`${row.epoch}:${row.revision}:${row.from}`).sort();}
function stateKey(snapshot,trace){return JSON.stringify({phase:snapshot.phase,leaderId:snapshot.leaderId,live:snapshot.live,committed:snapshot.committed,holders:snapshot.holders,visible:snapshot.visible,pending:snapshot.pending,nodes:snapshot.nodes,rejectedStale:snapshot.rejectedStale,rejectedConflict:snapshot.rejectedConflict,deliveredAcks:ackHistory(trace)});}
function candidates(snapshot){
  const out=[];for(const row of snapshot.pending){const descriptor={serial:row.serial,type:row.type,from:row.from,to:row.to,epoch:row.epoch,revision:row.revision};out.push({kind:'deliver',...descriptor},{kind:'drop',...descriptor});}
  if(snapshot.live.length===members.length)for(const member of members)out.push({kind:'crash',member});
  if(snapshot.phase===PACKET_PHASE.RECOVERING)for(const member of snapshot.live)out.push({kind:'recover',member});
  if(snapshot.phase===PACKET_PHASE.OPEN&&snapshot.visible.length===0)out.push({kind:'publish'});
  return out;
}

export function proveBoundedF1ScheduleStateSpace({maxDepth=16,maxStates=100000}={}){
  if(!Number.isInteger(maxDepth)||maxDepth<1||!Number.isInteger(maxStates)||maxStates<100)throw Error('Invalid state-space bound');
  const visited=new Set(),stack=[[]],violations=[];let explored=0,transitions=0,invalidTransitions=0,maxObservedDepth=0,visibleStates=0,recoveredStates=0;
  while(stack.length){
    const trace=stack.pop();let protocol;try{protocol=replay(trace);}catch{invalidTransitions++;continue;}const snapshot=protocol.snapshot(),key=stateKey(snapshot,trace);if(visited.has(key))continue;visited.add(key);explored++;maxObservedDepth=Math.max(maxObservedDepth,trace.length);if(explored>maxStates)throw Error('Canon state-space proof exceeded bound');
    if(snapshot.visible.length)visibleStates++;if(snapshot.epoch>1&&snapshot.phase===PACKET_PHASE.OPEN)recoveredStates++;if(!snapshot.safety.pass){violations.push({trace:trace.map(actionKey),snapshot});continue;}if(trace.length>=maxDepth)continue;
    for(const action of candidates(snapshot)){transitions++;stack.push([...trace,action]);}
  }
  return{pass:violations.length===0&&visibleStates>0&&recoveredStates>0,explored,transitions,invalidTransitions,maxObservedDepth,visibleStates,recoveredStates,violations,scope:'one Canon operation, 3 members, at most one crash, arbitrary delivery/drop order, optional publication timing and any live recovery candidate, no retries/duplicates'};
}
