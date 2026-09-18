import { readFileSync } from 'node:fs';

const finiteNonNegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const int=value=>Number.isSafeInteger(value)&&value>=0;

export function analyzeShadowCapture(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('capture must be an object');
  const checkpoint=raw.semanticCheckpointBytes,journal=raw.semanticJournalBytes,events=raw.semanticEventCount,effects=raw.semanticHistoryEffects;
  if(![checkpoint,journal,events,effects].every(Array.isArray))throw Error('semantic capture arrays are required');
  const n=checkpoint.length;if(!n||journal.length!==n||events.length!==n||effects.length!==n)throw Error('semantic capture arrays must be aligned and non-empty');
  let protectedCommits=0,allStateStrongBytes=0,semanticStrongBytes=0,semanticEvents=0,historyEffects=0;
  for(let i=0;i<n;i++){
    if(!finiteNonNegative(checkpoint[i])||!finiteNonNegative(journal[i])||!int(events[i])||!int(effects[i]))throw Error('invalid semantic capture sample');
    if(events[i]>0){protectedCommits++;allStateStrongBytes+=checkpoint[i];semanticStrongBytes+=journal[i];semanticEvents+=events[i];historyEffects+=effects[i];}
    else if(journal[i]!==0||effects[i]!==0)throw Error('zero-event sample cannot carry semantic bytes/effects');
  }
  const fairKnownEventSourcingBytes=semanticStrongBytes;
  const savingBytes=allStateStrongBytes-semanticStrongBytes;
  return Object.freeze({
    samples:n,protectedCommits,semanticEvents,historyEffects,allStateStrongBytes,semanticStrongBytes,fairKnownEventSourcingBytes,
    savingBytes,savingRatio:allStateStrongBytes>0?savingBytes/allStateStrongBytes:null,
    fairBaselineMatches:fairKnownEventSourcingBytes===semanticStrongBytes,
    scope:'counterfactual JSON payload bytes at observed protected commits; excludes framing, compression, replication factor, crypto, radio and actual switched-authority latency'
  });
}

export function comparableCaptureSet(captures){
  if(!Array.isArray(captures)||captures.length<2)throw Error('at least two captures are required');
  const meta=captures.map(row=>row?._capture??{}),first=meta[0];
  const fields=['worldId','expectedPeers','buildRevision','environment','workloadId'];
  const mismatches=[];
  for(let i=1;i<meta.length;i++)for(const field of fields)if(first[field]!==meta[i][field])mismatches.push({index:i,field,left:first[field]??null,right:meta[i][field]??null});
  if(meta.some(row=>row.windowArmed!==true))mismatches.push({field:'windowArmed',reason:'every capture must come from an armed steady window'});
  return Object.freeze({comparable:mismatches.length===0,mismatches});
}

export function analyzeCaptureFiles(paths){
  if(!Array.isArray(paths)||!paths.length)throw Error('capture files required');
  return paths.map(path=>{const raw=JSON.parse(readFileSync(path,'utf8'));return {path,meta:raw._capture??null,analysis:analyzeShadowCapture(raw)};});
}

if(import.meta.url===`file://${process.argv[1]}`){
  const paths=process.argv.slice(2);if(!paths.length)throw Error('usage: node rrp-convergence-shadow-capture.mjs <capture.json> [...]');
  const rows=analyzeCaptureFiles(paths);const compatibility=paths.length>1?comparableCaptureSet(paths.map(path=>JSON.parse(readFileSync(path,'utf8')))):null;
  console.log(JSON.stringify({format:'rrp-convergence-shadow-capture-v1',compatibility,rows},null,2));
}
