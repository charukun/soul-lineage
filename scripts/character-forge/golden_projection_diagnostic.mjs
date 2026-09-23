/** Isolated real-pixel projection on the rejected Golden Base geometry. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const source='.forge-resume-golden/evidence.tar.gz';
const original='be387859d60630d1e8c9e30397277bc2d3e88456';
const archiveSha='ea9670e9ef44ffa8e4a4727224d6e434b581d302a2aeb3bc3a3c50e4c9b62b01';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!existsSync(source)||hash(readFileSync(source))!==archiveSha)throw Error('Corrected blockout artifact changed');
if(readFileSync('.forge-resume-golden/source-sha.txt','utf8').trim()!==original)throw Error('Source branch head differs');
mkdirSync('test-results',{recursive:true});
const run=(command,args)=>execFileSync(command,args,{stdio:'inherit'});
run('tar',['--no-same-owner','-xzf',source,'-C','test-results']);
const workspace='test-results/character-forge-upstream/golden-base-v1';
const state=JSON.parse(readFileSync(join(workspace,'.img2threejs/state.json')));
if(state.currentPass!=='blockout'||state.currentStep!=='review-contract-read'||state.loops.perPass.blockout!==1)
  throw Error('Do not project onto a different or accepted upstream state');
run('npm',['ci','--ignore-scripts']);
run('npx',['playwright','install','--with-deps','chromium']);
run('node',['scripts/character-forge/render_upstream.mjs',workspace,'blockout','--projection-diagnostic']);
const dir=join(workspace,'review/blockout-projection-diagnostic');
const result=JSON.parse(readFileSync(join(dir,'projection-bake.json')));
const rows=result.outputs;
if(rows.length!==2||!rows.some(x=>x.mesh==='Bald cranium cheeks eye plane jaw chin nose')||
   !rows.some(x=>x.mesh==='Gray sleeveless torso'))throw Error('Projection did not target the observed head and suit torso');
for(const row of rows){
  if(!row.coverage.observed||!row.files.albedo||!existsSync(join(workspace,row.files.albedo)))
    throw Error('Reference pixels did not bake to '+row.mesh);
}
const receipt=JSON.parse(readFileSync(join(dir,'render-receipt.json')));
if(receipt.errors.length||receipt.visualApproval!=='pending'||receipt.pass!=='blockout')
  throw Error('Projection diagnostic cannot approve upstream quality');
writeFileSync(join(dir,'coordinate-projection-report.json'),JSON.stringify({
  schema:'rinne.golden-projection-diagnostic/v1',sourceHead:process.env.HEAD_SHA,
  restoredHead:original,scope:'head and suit torso only on rejected blockout',
  modelPass:'blockout',approval:'none',geometryStatus:'rejected by upstream silhouette gate',
  baked:rows.map(row=>({mesh:row.mesh,coverage:row.coverage,method:row.method,
    albedoSha256:hash(readFileSync(join(workspace,row.files.albedo)))})),
  sourceViews:['front','side','back'].map(view=>({view,sha256:hash(readFileSync(join(workspace,'source',view+'.png')))}))
},null,2));
console.log('GOLDEN_PIXEL_PROJECTION '+JSON.stringify(rows.map(x=>({mesh:x.mesh,coverage:x.coverage}))));
