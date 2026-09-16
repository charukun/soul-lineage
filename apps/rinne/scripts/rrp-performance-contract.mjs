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
const RAW_COUNTER_KEYS=Object.freeze(['bandwidthSkippedBuckets','connectionAttempts','connectionSuccesses','turnCandidateClassifiedConnections','turnRelayConnections','missingSamples','expectedSamples']);

export function mergeRawPerformanceCaptures(captures=[]){
  if(!Array.isArray(captures)||captures.length<1)throw Error('Performance capture list is required');
  const merged=Object.fromEntries(RAW_ARRAY_KEYS.map(key=>[key,[]]));
  for(const key of RAW_COUNTER_KEYS)merged[key]=0;
  merged.durationMinutes=0;
  for(const capture of captures){
    if(!capture||typeof capture!=='object'||Array.isArray(capture))throw Error('Invalid performance capture');
    for(const key of RAW_ARRAY_KEYS){if(capture[key]==null)continue;if(!Array.isArray(capture[key]))throw Error(`Invalid capture array ${key}`);merged[key].push(...capture[key]);}
    for(const key of RAW_COUNTER_KEYS){const value=Number(capture[key]??0);if(!Number.isInteger(value)||value<0)throw Error(`Invalid capture counter ${key}`);merged[key]+=value;}
    const duration=Number(capture.durationMinutes??0);if(!Number.isFinite(duration)||duration<0)throw Error('Invalid capture duration');merged.durationMinutes+=duration;
  }
  return merged;
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
  const rawSamples=Array.isArray(input.captures)?mergeRawPerformanceCaptures(input.captures):input.rawSamples;
  if(!rawSamples)throw Error('Performance evidence build requires rawSamples or captures');
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
