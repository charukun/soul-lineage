/** Hosted, exact-head Golden Base reconstruction checkpoint. No visual approval. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const run=(bin,args,options={})=>execFileSync(bin,args,{stdio:'inherit',...options});
const workspace='test-results/character-forge-upstream/golden-base-v1';
const cache='.cache/character-forge-upstream';
const args=['--workspace',workspace,'--cache',cache];
run('python3',['-m','pip','install','-r','packages/assets/forge/requirements.txt']);
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
run('python3',['scripts/character-forge/start_golden_base.py',...args]);
run('python3',['scripts/character-forge/prepare_golden_base_evidence.py',...args]);
run('python3',['scripts/character-forge/prepare_projection_maps.py',...args]);
run('python3',['scripts/character-forge/mark_golden_base_intake.py',...args]);
run('python3',['scripts/character-forge/prepare_golden_base_materials.py',...args]);
run('python3',['scripts/character-forge/author_golden_base_spec.py',...args]);
run('python3',['scripts/character-forge/mark_golden_base_spec.py',...args]);
run('python3',[resolve('.cache/character-forge-upstream/img2threejs-6e60b5e22419464b4853e01ddb6c0e6f6659a733/forge/stage3_build/generate_threejs_factory.py'),
  'object-sculpt-spec.json','--out','build/blockout.ts','--pass-id','blockout'],{cwd:workspace});
run('npm',['ci','--ignore-scripts']);
run('node',['--test','scripts/character-forge/uv-gutter.test.mjs','scripts/character-forge/reference-camera.test.mjs']);
run('npx',['playwright','install','--with-deps','chromium']);
run('node',['scripts/character-forge/render_upstream.mjs',workspace,'blockout']);
run('python3',['scripts/character-forge/review_upstream.py',...args,'--pass-id','blockout']);
// Status is deliberately evidence, not a fabricated approval. A failing
// upstream diagnostic is recorded in the artifact for the next correction.
const dir=workspace+'/review/blockout';
const names=['front','side','back'];
const results=Object.fromEntries(names.map(name=>[name,JSON.parse(readFileSync(dir+'/'+name+'-diagnostics.json'))]));
mkdirSync(workspace+'/img2threejs/evidence',{recursive:true});
writeFileSync(workspace+'/img2threejs/evidence/hosted-checkpoint.json',JSON.stringify({
  sourceHead:process.env.HEAD_SHA,stage:'Golden Base blockout',
  result:'comparison captured; agent review and correction pending',
  gateResults:Object.fromEntries(names.map(name=>[name,results[name].passed])),
},null,2));
console.log('GOLDEN_BASE_BLOCKOUT '+JSON.stringify(Object.fromEntries(names.map(name=>[name,results[name].passed]))));
