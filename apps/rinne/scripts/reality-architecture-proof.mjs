import {runArchitectureProofLoop} from '../src/game/reality-lab/proof-loop.js';
const report=runArchitectureProofLoop();
const compact={format:report.format,pass:report.pass,checks:report.canon.checks,costCases:report.canon.cost.cases,boundaries:report.boundaries,matrix:report.cases.map(row=>({id:row.id,pass:row.pass,cellLoadRatio:row.presence.cellLoadRatio,phase:Object.fromEntries(row.results.map(result=>[result.mode,result.phase])),migrations:Object.fromEntries(row.results.map(result=>[result.mode,result.migrations.length]))})),limits:report.limits};
console.log(JSON.stringify(compact,null,2));
if(!report.pass)process.exitCode=1;
