import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { analyzeShadowCapture, comparableCaptureSet } from './rrp-convergence-shadow-capture.mjs';
import { mergeRawPerformanceCaptures } from './rrp-performance-contract.mjs';
import { aggregateRrpPerformanceSamples, percentile, RRP_RATCHET } from '../src/game/reality-lab/performance-contract.js';

export const FINAL_VARIANTS=Object.freeze(['all-state-strong','semantic-journal','fair-known-event-sourcing']);
const sum=values=>Array.isArray(values)?values.reduce((total,value)=>total+(Number.isFinite(Number(value))?Number(value):0),0):0;
const p95=values=>Array.isArray(values)&&values.length?percentile(values,.95):null;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const metaOf=capture=>capture?._capture??{};
const diagOf=capture=>capture?._diagnostics??{};
const journalTypes=capture=>diagOf(capture)?.semanticShadow?.journalTypes??[];

function captureIssues(capture){
  const issues=[],meta=metaOf(capture),diag=diagOf(capture);
  if(meta.schema!=='rrp-raw-peer-capture')issues.push('capture-schema');
  if(meta.windowArmed!==true)issues.push('capture-window-not-armed');
  if(Array.isArray(capture?.variantErrors)&&capture.variantErrors.length)issues.push('variant-write-error');
  if(Number(capture?.bandwidthSkippedBuckets||0)>0)issues.push('unobserved-bandwidth-buckets');
  if(diag?.semanticError)issues.push('semantic-shadow-error');
  if(diag?.semanticPersistenceError)issues.push('semantic-persistence-error');
  if(diag?.semanticShadow?.status==='diverged')issues.push('semantic-shadow-diverged');
  return issues;
}

function requiredMetricStatus(metrics,hostMetrics,merged){
  const fields={
    inputToAuthoritativeAck:metrics.inputToAuthoritativeAckP95Ms,
    inputToDisplay:metrics.inputToDisplayP95Ms,
    protectedCommitLatency:hostMetrics.canonCommitP95Ms,
    hostUplink:metrics.hostUplinkP95Kbps,
    peerUplink:metrics.peerUplinkP95Kbps,
    reliableQueue:metrics.reliableBufferedAmountMaxBytes,
    presenceQueue:metrics.presenceBufferedAmountMaxBytes,
    stateFreshness:metrics.stateFreshnessP95Ms,
    rollback:metrics.rollbackP95Ms,
    frame:metrics.frameP95Ms,
    hostLossDetection:metrics.hostLossDetectionP95Ms,
    hostReopen:metrics.hostReopenP95Ms,
    connectionSuccess:metrics.connectionSuccessRate,
    turnRelay:metrics.turnRelayRate,
  };
  const missing=Object.entries(fields).filter(([,value])=>value==null||!finite(value)).map(([key])=>key);
  if(Number(merged.turnCandidateClassifiedConnections||0)<=0&&!missing.includes('turnRelay'))missing.push('turnRelay');
  return{fields,missing};
}

export function analyzeVariantCaptureGroup(captures,expectedVariant){
  if(!Array.isArray(captures)||!captures.length)throw Error('variant capture group is required');
  if(captures.some(capture=>metaOf(capture).variant!==expectedVariant))throw Error(`capture variant mismatch for ${expectedVariant}`);
  const compatibility=comparableCaptureSet(captures),meta=metaOf(captures[0]),target=Number(meta.expectedPeers);
  const peerIds=new Set(captures.map(capture=>String(metaOf(capture).peerId||''))),hosts=captures.filter(capture=>metaOf(capture).role==='host'),guests=captures.filter(capture=>metaOf(capture).role==='guest');
  const issues=[...captures.flatMap(capture=>captureIssues(capture))];
  if(!compatibility.comparable)issues.push('capture-provenance-mismatch');
  if(!Number.isInteger(target)||target<2||peerIds.has('')||peerIds.size!==target||captures.length!==target)issues.push('endpoint-cohort-incomplete');
  if(hosts.length!==1||guests.length!==target-1)issues.push('host-guest-role-mismatch');
  let semantic=null;try{semantic=hosts.length===1?analyzeShadowCapture(hosts[0]):null;}catch{issues.push('semantic-capture-invalid');}
  const merged=mergeRawPerformanceCaptures(captures),metrics=aggregateRrpPerformanceSamples(merged),hostMetrics=hosts.length===1?aggregateRrpPerformanceSamples(hosts[0]):{};
  const measurement={
    bootstrapBytes:sum(hosts[0]?.variantBootstrapBytes),bootstrapP95Ms:p95(hosts[0]?.variantBootstrapMs),
    commitBytes:sum(hosts[0]?.variantCommitBytes),commitP95Ms:p95(hosts[0]?.variantCommitMs),
    protectedCommitBytes:sum(hosts[0]?.variantProtectedBytes),protectedCommitP95Ms:p95(hosts[0]?.variantProtectedCommitMs),
    provisionalBytes:sum(hosts[0]?.variantProvisionalBytes),provisionalP95Ms:p95(hosts[0]?.variantProvisionalWriteMs),
  };
  measurement.totalPersistenceBytes=measurement.bootstrapBytes+measurement.commitBytes+measurement.provisionalBytes;
  const required=requiredMetricStatus(metrics,hostMetrics,merged);
  if(!semantic||semantic.protectedCommits<1)issues.push('no-protected-commit');
  if(measurement.bootstrapBytes<=0)issues.push('variant-bootstrap-missing');
  if(measurement.protectedCommitBytes<=0)issues.push('variant-protected-write-missing');
  const optional={
    gpuP95Ms:metrics.gpuP95Ms,memoryPeakMb:metrics.memoryPeakMb,batteryPctPerHour:metrics.batteryPctPerHour,
    capability:meta.capabilities??null,
  };
  return Object.freeze({
    variant:expectedVariant,meta:Object.freeze({...meta}),compatibility,issues:[...new Set(issues)],semantic,measurement,
    runtime:Object.freeze({metrics,hostProtectedCommitP95Ms:hostMetrics.canonCommitP95Ms,connectionAttempts:merged.connectionAttempts,connectionSuccesses:merged.connectionSuccesses,turnCandidateClassifiedConnections:merged.turnCandidateClassifiedConnections,turnRelayConnections:merged.turnRelayConnections}),
    required,optional,journalTypes:hosts.length===1?[...journalTypes(hosts[0])]:[],
  });
}

function crossVariantCompatibility(rows){
  const mismatches=[],first=rows[0]?.meta??{};
  for(const row of rows.slice(1))for(const field of ['buildRevision','environment','expectedPeers','workloadId'])if(row.meta?.[field]!==first[field])mismatches.push({variant:row.variant,field,baseline:first[field]??null,current:row.meta?.[field]??null});
  const semantic=rows.find(row=>row.variant==='semantic-journal'),known=rows.find(row=>row.variant==='fair-known-event-sourcing');
  if(semantic&&known&&semantic.meta.rpoSeconds!==known.meta.rpoSeconds)mismatches.push({variant:known.variant,field:'rpoSeconds',baseline:semantic.meta.rpoSeconds,current:known.meta.rpoSeconds});
  const eventShape=rows[0]?.journalTypes??[];for(const row of rows.slice(1))if(!same(eventShape,row.journalTypes))mismatches.push({variant:row.variant,field:'protected-event-sequence',baseline:eventShape,current:row.journalTypes});
  const eventCount=rows[0]?.semantic?.semanticEvents??null;for(const row of rows.slice(1))if(row.semantic?.semanticEvents!==eventCount)mismatches.push({variant:row.variant,field:'protected-event-count',baseline:eventCount,current:row.semantic?.semanticEvents??null});
  return Object.freeze({comparable:mismatches.length===0,mismatches});
}

function ratio(after,before){return finite(after)&&finite(before)&&before>0?after/before:null;}

export function analyzeFinalSemanticKernelCaptureSet(captures){
  if(!Array.isArray(captures)||!captures.length)throw Error('captures are required');
  const groups=new Map(FINAL_VARIANTS.map(variant=>[variant,captures.filter(capture=>metaOf(capture).variant===variant)]));
  const missingVariants=FINAL_VARIANTS.filter(variant=>!groups.get(variant).length);
  const rows=FINAL_VARIANTS.filter(variant=>groups.get(variant).length).map(variant=>analyzeVariantCaptureGroup(groups.get(variant),variant));
  const cross=rows.length===FINAL_VARIANTS.length?crossVariantCompatibility(rows):Object.freeze({comparable:false,mismatches:missingVariants.map(variant=>({variant,field:'variant-capture',baseline:'required',current:'missing'}))});
  const byVariant=Object.fromEntries(rows.map(row=>[row.variant,row])),all=byVariant['all-state-strong'],semantic=byVariant['semantic-journal'],known=byVariant['fair-known-event-sourcing'];
  const issues=[...missingVariants.map(variant=>`missing-${variant}`),...rows.flatMap(row=>row.issues.map(issue=>`${row.variant}:${issue}`))];
  if(!cross.comparable)issues.push('cross-variant-not-comparable');
  const requiredMissing=rows.flatMap(row=>row.required.missing.map(metric=>`${row.variant}:${metric}`));
  const comparison=all&&semantic&&known?{
    allStateToSemanticTotalBytesRatio:ratio(semantic.measurement.totalPersistenceBytes,all.measurement.totalPersistenceBytes),
    allStateToSemanticProtectedBytesRatio:ratio(semantic.measurement.protectedCommitBytes,all.measurement.protectedCommitBytes),
    semanticToKnownTotalBytesRatio:ratio(semantic.measurement.totalPersistenceBytes,known.measurement.totalPersistenceBytes),
    semanticToKnownProtectedBytesRatio:ratio(semantic.measurement.protectedCommitBytes,known.measurement.protectedCommitBytes),
    semanticProtectedLatencyVsAllStateRatio:ratio(semantic.measurement.protectedCommitP95Ms,all.measurement.protectedCommitP95Ms),
    knownProtectedLatencyVsSemanticRatio:ratio(known.measurement.protectedCommitP95Ms,semantic.measurement.protectedCommitP95Ms),
    semanticLatencyWithinExistingRatchet:finite(semantic.measurement.protectedCommitP95Ms)&&finite(all.measurement.protectedCommitP95Ms)?semantic.measurement.protectedCommitP95Ms<=all.measurement.protectedCommitP95Ms*RRP_RATCHET.canonCommitP95Ms:null,
    knownAndSemanticUseIdenticalImplementationPath:true,
  }:null;
  const physicalComplete=issues.length===0&&requiredMissing.length===0&&cross.comparable;
  let architectureDecision='insufficient-physical-evidence';
  if(physicalComplete&&comparison){
    if(semantic.measurement.totalPersistenceBytes<all.measurement.totalPersistenceBytes&&comparison.semanticLatencyWithinExistingRatchet)architectureDecision='semantic-split-with-known-event-sourcing';
    else if(known.measurement.totalPersistenceBytes<semantic.measurement.totalPersistenceBytes)architectureDecision='fair-known-event-sourcing';
    else architectureDecision='no-material-automatic-winner';
  }
  return Object.freeze({
    format:'semantic-kernel-final-comparison-v1',physicalComplete,architectureDecision,
    issues:[...new Set(issues)],requiredMissing:[...new Set(requiredMissing)],crossVariantCompatibility:cross,
    variants:byVariant,comparison,
    interpretation:Object.freeze({
      authority:'coop-v2 remains the gameplay authority during measurement',
      variantWrites:'DEV-only matched localStorage persistence measurements use exact runtime checkpoint/journal payloads and do not decide gameplay success',
      semanticVsKnown:'semantic-journal and fair-known-event-sourcing intentionally share the same semantic encoding/write path; any measured difference is run noise, not a new consensus advantage',
      battery:'battery remains absent unless a trustworthy device source supplied samples; missing battery is not fabricated',
    }),
  });
}

export function analyzeFinalSemanticKernelFiles(paths){
  return analyzeFinalSemanticKernelCaptureSet(paths.map(path=>JSON.parse(readFileSync(path,'utf8'))));
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isMain){
  const paths=process.argv.slice(2);if(!paths.length)throw Error('usage: node semantic-kernel-final-compare.mjs <capture.json> [...]');
  const result=analyzeFinalSemanticKernelFiles(paths);process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(!result.physicalComplete)process.exitCode=2;
}
