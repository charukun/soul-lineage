import {createDeterministicScaleReplay,runScaleReplay} from '@soul/rendering/replay-benchmark';
import {planWorldScale} from '@soul/world/scale-policy';
const seed=Number(process.argv[2]||90210);const replay=createDeterministicScaleReplay({seed});const report=await runScaleReplay({replay,planner:payload=>planWorldScale(payload)});console.log(JSON.stringify(report,null,2));if(report.averageMs>8){console.error(`World-scale planner average ${report.averageMs.toFixed(2)}ms exceeds 8ms review budget`);process.exitCode=1;}
