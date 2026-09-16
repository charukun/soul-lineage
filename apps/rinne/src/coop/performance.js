const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const clampSeq=value=>Number.isSafeInteger(value)&&value>=0?value:null;

export function createCoopPerformanceProbe({role='peer',now=()=>performance.now(),maxSamples=4096}={}){
  if(!['host','peer'].includes(role))throw Error('Unknown co-op performance role');
  if(!Number.isInteger(maxSamples)||maxSamples<32)throw Error('Invalid co-op performance sample bound');
  const startedAt=now(),inputStarted=new Map(),canonStarted=new Map(),opened=new WeakSet();
  const raw={
    inputToDisplayMs:[],canonCommitMs:[],hostLossDetectionMs:[],hostReopenMs:[],
    peerUplinkKbps:[],hostUplinkKbps:[],reliableBufferedAmountBytes:[],presenceBufferedAmountBytes:[],
    stateFreshnessMs:[],positionErrorM:[],rollbackMs:[],frameMs:[],gpuMs:[],memoryMb:[],batteryPctPerHour:[],
  };
  let txWindowStartedAt=startedAt,txWindowBytes=0,connectionAttempts=0,connectionSuccesses=0,turnRelayConnections=0;
  const push=(key,value)=>{if(!finite(value))return false;const list=raw[key];if(!list)return false;list.push(value);if(list.length>maxSamples)list.splice(0,list.length-maxSamples);return true;};
  function flushTx(force=false){
    const at=now(),elapsed=at-txWindowStartedAt;
    if(elapsed<1000&&!force)return false;
    if(elapsed>0&&txWindowBytes>0)push(role==='host'?'hostUplinkKbps':'peerUplinkKbps',txWindowBytes*8/elapsed);
    txWindowStartedAt=at;txWindowBytes=0;return true;
  }
  function recordSend({payloadBytes=0,reliableBufferedAmount=null,presenceBufferedAmount=null}={}){
    flushTx(false);if(finite(Number(payloadBytes)))txWindowBytes+=Number(payloadBytes);
    push('reliableBufferedAmountBytes',Number(reliableBufferedAmount));push('presenceBufferedAmountBytes',Number(presenceBufferedAmount));
  }
  function inputSent(seq){seq=clampSeq(seq);if(seq==null)return false;inputStarted.set(seq,now());return true;}
  function inputAcknowledged(seq){
    seq=clampSeq(seq);if(seq==null)return false;const at=now();let recorded=false;
    for(const [pending,start]of [...inputStarted])if(pending<=seq){push('inputToDisplayMs',Math.max(0,at-start));inputStarted.delete(pending);recorded=true;}
    return recorded;
  }
  function canonIntent(id){id=String(id||'');if(!id)return false;canonStarted.set(id,now());return true;}
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
      if(local?.candidateType==='relay'||remote?.candidateType==='relay')turnRelayConnections++;
    }catch{/* stats support is optional; leave TURN classification unknown */}
    return true;
  }
  const recordStateFreshness=value=>push('stateFreshnessMs',Number(value));
  const recordPositionError=value=>push('positionErrorM',Number(value));
  const recordRollback=value=>push('rollbackMs',Number(value));
  const recordFrame=value=>push('frameMs',Number(value));
  const recordGpu=value=>push('gpuMs',Number(value));
  const recordMemory=value=>push('memoryMb',Number(value));
  const recordBatteryRate=value=>push('batteryPctPerHour',Number(value));
  const recordHostLossDetection=value=>push('hostLossDetectionMs',Number(value));
  const recordHostReopen=value=>push('hostReopenMs',Number(value));
  function snapshot({flush=false}={}){
    if(flush)flushTx(true);else flushTx(false);
    return structuredClone({...raw,durationMinutes:Math.max(0,(now()-startedAt)/60000),connectionAttempts,connectionSuccesses,connectedPeers:connectionSuccesses,turnRelayConnections,pendingInputs:inputStarted.size,pendingCanon:canonStarted.size});
  }
  return{recordSend,inputSent,inputAcknowledged,canonIntent,canonCommitted,canonAborted,connectionAttempt,connectionOpen,recordStateFreshness,recordPositionError,recordRollback,recordFrame,recordGpu,recordMemory,recordBatteryRate,recordHostLossDetection,recordHostReopen,snapshot};
}
