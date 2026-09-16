import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  EVIDENCE_CLASS,RRP_PERFORMANCE_METRICS,RRP_SAFETY_KEYS,
  compareRrpPerformanceEvidence,evaluateRrpPerformanceContract,normalizeRrpPerformanceEvidence,
} from '../src/game/reality-lab/performance-contract.js';

const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
const print=value=>process.stdout.write(`${JSON.stringify(value,null,2)}\n`);

export function performanceEvidenceTemplate(evidenceClass=EVIDENCE_CLASS.PHYSICAL_MULTIPEER){
  if(!Object.values(EVIDENCE_CLASS).includes(evidenceClass))throw Error('Unknown evidence class');
  return {
    evidenceClass,
    samples:0,
    metrics:Object.fromEntries(RRP_PERFORMANCE_METRICS.map(key=>[key,null])),
    safety:Object.fromEntries(RRP_SAFETY_KEYS.map(key=>[key,null])),
    provenance:evidenceClass===EVIDENCE_CLASS.PHYSICAL_MULTIPEER?{buildRevision:'',runtime:'',deviceClass:'',deviceModel:'',peers:2,networkProfile:''}:{},
  };
}

export function validatePerformanceEvidence(input,{requirePhysicalCertification=false}={}){
  const evidence=normalizeRrpPerformanceEvidence(input);
  return evaluateRrpPerformanceContract(evidence,{requirePhysicalCertification});
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain){
  const command=process.argv[2];
  const args=process.argv.slice(3);
  const get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
  if(command==='template'){
    print(performanceEvidenceTemplate(get('--class')||EVIDENCE_CLASS.PHYSICAL_MULTIPEER));
  }else if(command==='validate'){
    const input=get('--input');if(!input)throw Error('validate requires --input <evidence.json>');
    const result=validatePerformanceEvidence(readJson(input),{requirePhysicalCertification:args.includes('--require-physical')});
    print(result);if(result.status==='fail'||args.includes('--require-physical')&&!result.physicalCertificationEligible)process.exitCode=1;
  }else if(command==='compare'){
    const baseline=get('--baseline'),current=get('--current');if(!baseline||!current)throw Error('compare requires --baseline <json> --current <json>');
    const result=compareRrpPerformanceEvidence(readJson(baseline),readJson(current));print(result);if(!result.pass)process.exitCode=1;
  }else throw Error('Use rrp-performance-contract.mjs template|validate|compare');
}
