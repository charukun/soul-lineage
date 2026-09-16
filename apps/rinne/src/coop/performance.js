const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const clampSeq=value=>Number.isSafeInteger(value)&&value>=0?value:null;

export function createCoopPerformanceProbe({role='peer',now=()=>performance.now(),maxSamples=4096}={}){
  if(!['host','peer'].includes(role))throw Error('Unknown co-op performance role');
  if(!Number.isInteger(maxSamples)||maxSamples<32)throw Error('Invalid co-op performance sample bound');
  const startedAt=now(),inputStarted=new Map(),acknowledgedInputs=new Map(),canonStarted=new Map(),opened=new WeakSet();
  const raw={inputToAuthoritativeAckMs:[],inputToDisplayMs:[],canonCommitMs:[],hostLossDetectionMs:[],hostReopenMs:[],peerUplinkKbps:[],hostUplinkKbps:[],reliableBufferedAmountBytes:[],presenceBufferedAmountBytes:[],stateFreshnessMs:[],positionErrorM:[],rollbackMs:[],frameMs:[],gpuMs:[],memoryMb:[],batteryPctPerHour:[]};
  let txBucket=0,txBucketBytes=0,bandwidthSkippedBuckets=0,connectionAttempts=0,connectionSuccesses=0,turnCandidateClassifiedConnections=0,turnRelayConnections=0;
  const push=(key,value)=>{if(!finite(value))return false;const list=raw[key];if(!list)return false;list.push(value);if(list.length>maxSamples)list.splice(0,list.length-maxSamples);return true;};
  const trimMap=map=>{while(map.size>maxSamples)map.delete(map.keys().next().value);};
  function advanceTxBuckets(){
    const elapsed=Math.max(0,now()-startedAt),nextBucket=Math.floor(elapsed/1000),gap=nextBucket-txBucket;if(gap<=0)return;
    const key=role==='host'?'hostUplinkKbps':'peerUplinkKbps';
    // Only the first completed bucket is observed. If the probe was not sampled for multiple seconds,
    // omit those unknown buckets instead of fabricating idle zero traffic (e.g. after background suspension).
    push(key,txBucketBytes*8/1000);if(gap>1)bandwidthSkippedBuckets+=gap-1;
    txBucket=nextBucket;txBucketBytes=0;
  }
  function recordSend({payloadBytes=0,reliableBufferedAmount=null,presenceBufferedAmount=null}={}){advanceTxBuckets();if(finite(Number(payloadBytes)))txBucketBytes+=Number(payloadBytes);push('reliableBufferedAmountBytes',Number(reliableBufferedAmount));push('presenceBufferedAmountBytes',Number(presenceBufferedAmount));}
  function inputSent(seq){seq=clampSeq(seq);if(seq==null)return false;inputStarted.set(seq,now());trimMap(inputStarted);return true;}
  function inputAborted(seq){seq=clampSeq(seq);if(seq==null)return false;acknowledgedInputs.delete(seq);return inputStarted.delete(seq);}
  function inputAcknowledged(seq){
    seq=clampSeq(seq);if(seq==null)return false;const at=now(),start=inputStarted.get(seq);
    for(const pending of [...inputStarted.keys()])if(pending<=seq)inputStarted.delete(pending);
    if(start==null)return false;push('inputToAuthoritativeAckMs',Math.max(0,at-start));acknowledgedInputs.set(seq,start);trimMap(acknowledgedInputs);return true;
  }
  function inputDisplayed(seq){
    seq=clampSeq(seq);if(seq==null)return false;const start=acknowledgedInputs.get(seq);
    for(const pending of [...acknowledgedInputs.keys()])if(pending<=seq)acknowledgedInputs.delete(pending);
    if(start==null)return false;push('inputToDisplayMs',Math.max(0,now()-start));return true;
  }
  const recordInputToDisplay=value=>push('inputToDisplayMs',Number(value));
  function canonIntent(id){id=String(id||'');if(!id)return false;canonStarted.set(id,now());trimMap(canonStarted);return true;}
  function canonCommitted(id){id=String(id||'');const start=canonStarted.get(id);if(start==null)return false;canonStarted.delete(id);push('canonCommitMs',Math.max(0,now()-start));return true;}
  function canonAborted(id){return canonStarted.delete(String(id||''));}
  function connectionAttempt(){connectionAttempts++;}
  async function connectionOpen(connection){
    if(!connection||typeof connection!=='object'||opened.has(connection))return false;opened.add(connection);connectionSuccesses++;
    const pc=connection.pc;if(!pc||typeof pc.getStats!=='function')return true;
    try{
      const report=await pc.getStats();let selected=null;
      report.forEach(row=>{if(row.type==='transport'&&row.selectedCandidatePairId)selected=row.selectedCandidatePairId;});
      let pair=selected?report.get(selected):null;
      if(!pair)report.forEach(row=>{if(!pair&&row.type==='candidate-pair'&&row.nominated&&row.state==='succeeded')pair=row;});
      const local=pair?.localCandidateId?report.get(pair.localCandidateId):null,remote=pair?.remoteCandidateId?report.get(pair.remoteCandidateId):null;
      const localType=local?.candidateType,remoteType=remote?.candidateType;
      if(localType||remoteType){turnCandidateClassifiedConnections++;if(localType==='relay'||remoteType==='relay')turnRelayConnections++;}
    }catch{/* stats support is optional; candidate type remains unknown */}
    return true;
  }
  const recordStateFreshness=value=>push('stateFreshnessMs',Number(value)),recordPositionError=value=>push('positionErrorM',Number(value)),recordRollback=value=>push('rollbackMs',Number(value)),recordFrame=value=>push('frameMs',Number(value)),recordGpu=value=>push('gpuMs',Number(value)),recordMemory=value=>push('memoryMb',Number(value)),recordBatteryRate=value=>push('batteryPctPerHour',Number(value)),recordHostLossDetection=value=>push('hostLossDetectionMs',Number(value)),recordHostReopen=value=>push('hostReopenMs',Number(value));
  function snapshot(){advanceTxBuckets();return structuredClone({...raw,durationMinutes:Math.max(0,(now()-startedAt)/60000),bandwidthSkippedBuckets,connectionAttempts,connectionSuccesses,connectedPeers:connectionSuccesses,turnCandidateClassifiedConnections,turnRelayConnections,pendingInputs:inputStarted.size,pendingDisplayInputs:acknowledgedInputs.size,pendingCanon:canonStarted.size});}
  return{recordSend,inputSent,inputAborted,inputAcknowledged,inputDisplayed,recordInputToDisplay,canonIntent,canonCommitted,canonAborted,connectionAttempt,connectionOpen,recordStateFreshness,recordPositionError,recordRollback,recordFrame,recordGpu,recordMemory,recordBatteryRate,recordHostLossDetection,recordHostReopen,snapshot};
}
