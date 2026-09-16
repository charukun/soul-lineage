import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  EVIDENCE_CLASS,RRP_PERFORMANCE_METRICS,RRP_SAFETY_KEYS,
  buildRrpPerformanceEvidenceFromSamples,compareRrpPerformanceEvidence,evaluateRrpPerformanceContract,normalizeRrpPerformanceEvidence,
} from '../src/game/reality-lab/performance-contract.js';

const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
const print=value=>process.stdout.write(`${JSON.stringify(value,null,2)}\n`);
const RAW_ARRAY_KEYS=Object.freeze([
  'inputToAuthoritativeAckMs','inputToDisplayMs','canonCommitMs','hostLossDetectionMs','hostReopenMs',
  'peerUplinkKbps','hostUplinkKbps','reliableBufferedAmountBytes','presenceBufferedAmountBytes',
  'stateFreshnessMs','positionErrorM','rollbackMs','frameMs','gpuMs','memoryMb','batteryPctPerHour',
  'modelDeliveryMs','modelQueue','modelDarkMs','modelRollbackMs',
]);
const CONNECTION_COUNTER_KEYS=Object.freeze(['connectionAttempts','connectionSuccesses','turnCandidateClassifiedConnections','turnRelayConnections']);
const RAW_COUNTER_KEYS=Object.freeze(['bandwidthSkippedBuckets',...CONNECTION_COUNTER_KEYS,'missingSamples','expectedSamples']);
const readCounter=(capture,key)=>{const value=Number(capture[key]??0);if(!Number.isInteger(value)||value<0)throw Error(`Invalid capture counter ${key}`);return value;};

function connectionEvidenceSources(captures){
  const complete=captures.every(capture=>['host','guest'].includes(capture._capture?.role)&&typeof capture._capture?.worldId==='string'&&capture._capture.worldId);
  if(!complete)return captures;
  const worlds=new Map();for(const capture of captures){const id=capture._capture.worldId;if(!worlds.has(id))worlds.set(id,[]);worlds.get(id).push(capture);}
  const sources=[];for(const group of worlds.values()){const hosts=group.filter(capture=>capture._capture.role==='host');sources.push(...(hosts.length?hosts:group));}return sources;
}

export function mergeRawPerformanceCaptures(captures=[]){
  if(!Array.isArray(captures)||captures.length<1)throw Error('Performance capture list is required');
  const merged=Object.fromEntries(RAW_ARRAY_KEYS.map(key=>[key,[]]));
  for(const key of RAW_COUNTER_KEYS)merged[key]=0;
  merged.durationMinutes=0;
  for(const capture of captures){
    if(!capture||typeof capture!=='object'||Array.isArray(capture))throw Error('Invalid performance capture');
    for(const key of RAW_ARRAY_KEYS){if(capture[key]==null)continue;if(!Array.isArray(capture[key]))throw Error(`Invalid capture array ${key}`);merged[key].push(...capture[key]);}
    for(const key of RAW_COUNTER_KEYS)readCounter(capture,key);
    for(const key of RAW_COUNTER_KEYS.filter(key=>!CONNECTION_COUNTER_KEYS.includes(key)))merged[key]+=readCounter(capture,key);
    const duration=Number(capture.durationMinutes??0);if(!Number.isFinite(duration)||duration<0)throw Error('Invalid capture duration');merged.durationMinutes+=duration;
  }
  // A Host and its Guests observe the same WebRTC links. Capture metadata lets us count the
  // Host endpoint once per world instead of doubling each link merely because both endpoints
  // exported evidence. A world with no surviving Host capture falls back to its Guest counters.
  // Legacy captures without complete role/world metadata retain the previous additive behavior.
  const connectionSources=connectionEvidenceSources(captures);
  for(const key of CONNECTION_COUNTER_KEYS)merged[key]=connectionSources.reduce((sum,capture)=>sum+readCounter(capture,key),0);
  return merged;
}

function validateRouteCaptureProvenance(captures,provenance){
  const routed=captures.filter(capture=>capture?._capture?.schema==='rrp-raw-peer-capture');if(!routed.length)return;
  if(routed.some(capture=>capture._capture.windowArmed!==true))throw Error('Physical capture window was not armed at the intended peer count');
  const targets=new Set(routed.map(capture=>Number(capture._capture.expectedPeers)));if(targets.size!==1||![...targets].every(value=>Number.isInteger(value)&&value>=2&&value<=30))throw Error('Physical captures disagree on expected peer count');
  const target=[...targets][0],declaredPeers=Number(provenance?.peers);if(!Number.isInteger(declaredPeers)||declaredPeers!==target)throw Error('Physical capture peer target does not match provenance.peers');
  const builds=new Set(routed.map(capture=>String(capture._capture.buildRevision||'')));if(builds.size!==1||![...builds][0]||String(provenance?.buildRevision||'')!==[...builds][0])throw Error('Physical capture build revision does not match provenance.buildRevision');
}

export function performanceEvidenceTemplate(evidenceClass=EVIDENCE_CLASS.PHYSICAL_MULTIPEER){
  if(!Object.values(EVIDENCE_CLASS).includes(evidenceClass))throw Error('Unknown evidence class');
  return {
    evidenceClass,
    samples:0,
    metrics:Object.fromEntries(RRP_PERFORMANCE_METRICS.map(key=>[key,null])),
    sampleCounts:Object.fromEntries(RRP_PERFORMANCE_METRICS.map(key=>[key,null])),
    safety:Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,null])),
    provenance:evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER?{buildRevision:'',runtime:'',deviceClass:'',deviceModel:'',peers:2,networkProfile:''}:{},
  };
}

export function buildPerformanceEvidence(input={}){
  const captures=Array.isArray(input.captures)?input.captures:null;if(input.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER&&captures)validateRouteCaptureProvenance(captures,input.provenance);
  const rawSamples=captures?mergeRawPerformanceCaptures(captures):input.rawSamples;
  if(!rawSamples)throw Error('Performance evidence build requires rawSamples or captures');
  const skipped=Number(rawSamples.bandwidthSkippedBuckets??0);
  if(!Number.isInteger(skipped)||skipped<0)throw Error('Invalid bandwidth skipped bucket count');
  if(input.evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER&&skipped>0)throw Error('Physical multipeer evidence contains unobserved bandwidth buckets; repeat with continuous sampling');
  return buildRrpPerformanceEvidenceFromSamples({...input,rawSamples});
}

export function validatePerformanceEvidence(input,{requirePhysicalCertification=false}={}){
  const evidence=normalizeRrpPerformanceEvidence(input);
  return evaluateRrpPerformanceContract(evidence,{requirePhysicalCertification});
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain){
  const command=process.argv[2],args=process.argv.slice(3),get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
  if(command==='template'){
    print(performanceEvidenceTemplate(get('--class')||EVIDENCE_CLASS.PHYSICAL_MULTIPEER));
  }else if(command==='build'){
    const input=get('--input');if(!input)throw Error('build requires --input <raw-capture.json>');
    print(buildPerformanceEvidence(readJson(input)));
  }else if(command==='validate'){
    const input=get('--input');if(!input)throw Error('validate requires --input <evidence.json>');
    const result=validatePerformanceEvidence(readJson(input),{requirePhysicalCertification:args.includes('--require-physical')});
    print(result);if(result.status==='fail'||args.includes('--require-physical')&&!result.physicalCertificationEligible)process.exitCode=1;
  }else if(command==='compare'){
    const baseline=get('--baseline'),current=get('--current');if(!baseline||!current)throw Error('compare requires --baseline <json> --current <json>');
    const result=compareRrpPerformanceEvidence(readJson(baseline),readJson(current));print(result);if(!result.pass)process.exitCode=1;
  }else throw Error('Use rrp-performance-contract.mjs template|build|validate|compare');
}
