import {runArchitectureProofLoop} from '../src/game/reality-lab/proof-loop.js';
const report=runArchitectureProofLoop();
const compact={
  format:report.format,pass:report.pass,
  canon:{checks:report.canon.checks,costCases:report.canon.cost.cases},
  semantic:{checks:report.semantic.checks,families:report.semantic.reachability.families,sweep:report.semantic.sweep,maximal:{pass:report.semantic.maximal.pass,strictUniversalDominancePossible:report.semantic.maximal.strictUniversalDominancePossible,weakPolicyClosure:report.semantic.maximal.weakPolicyClosure,strictExpansion:report.semantic.maximal.strictExpansion,lowerBoundHonesty:report.semantic.maximal.lowerBoundHonesty}},
  closure:{pass:report.closure.pass,totalPoints:report.closure.final.totalPoints,coveredPoints:report.closure.final.coveredPoints,futureFamilyAbsorbed:report.closure.absorbed.pass,monotoneObjectiveNoRegret:report.closure.objectives.pass},
  performanceContract:{pass:report.performanceContract.pass,checks:report.performanceContract.checks},
  boundaries:report.boundaries,
  matrix:report.cases.map(row=>({id:row.id,pass:row.pass,cellLoadRatio:row.presence.cellLoadRatio,phase:Object.fromEntries(row.results.map(result=>[result.mode,result.phase])),migrations:Object.fromEntries(row.results.map(result=>[result.mode,result.migrations.length])),performance:Object.fromEntries(Object.entries(row.performance).map(([mode,result])=>[mode,{status:result.status,evidenceClass:result.evidenceClass,physicalCertificationEligible:result.physicalCertificationEligible,modelDeliveryP95Ms:result.metrics.modelDeliveryP95Ms,hostUplinkAverageKbps:result.metrics.hostUplinkAverageKbps,peerUplinkAverageKbps:result.metrics.peerUplinkAverageKbps}]))})),
  limits:report.limits,
};
console.log(JSON.stringify(compact,null,2));
if(!report.pass)process.exitCode=1;
