/** Hosted, exact-head Golden Base reconstruction checkpoint. No visual approval. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const run=(bin,args,options={})=>execFileSync(bin,args,{stdio:'inherit',...options});
const workspace='test-results/character-forge-upstream/golden-base-v1';
const cache='.cache/character-forge-upstream';
const args=['--workspace',workspace,'--cache',cache];
const upstream=(entry,items)=>run('python3',['packages/assets/forge/upstream_workspace.py','run',...args,
  '--entry',entry,'--',...items]);
run('python3',['-m','pip','install','-r','packages/assets/forge/requirements.txt']);
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
const resume='.forge-resume-golden/evidence.tar.gz',bytes=readFileSync(resume);
if(createHash('sha256').update(bytes).digest('hex')!=='9bda7c8a302950c72ef4d113ab451adb5c6c7d37f45589d57276826708f52354')
  throw Error('Hosted evidence bytes changed; cannot replay correction');
if(readFileSync('.forge-resume-golden/source-sha.txt','utf8').trim()!=='58153c187c284c5b18298d7cc78f62b3b4568329')
  throw Error('Restored artifact is from another branch head');
mkdirSync('test-results',{recursive:true});
run('tar',['--no-same-owner','-xzf',resume,'-C','test-results']);
run('python3',['scripts/character-forge/resume_golden_base_rejection.py',...args]);
run('python3',['scripts/character-forge/author_golden_base_spec.py',...args]);
upstream('forge/stage3_build/generate_threejs_factory.py',[
  'object-sculpt-spec.json','--out','build/blockout.ts','--pass-id','blockout','--force']);
run('npm',['ci','--ignore-scripts']);
run('node',['--test','scripts/character-forge/uv-gutter.test.mjs','scripts/character-forge/reference-camera.test.mjs']);
run('npx',['playwright','install','--with-deps','chromium']);
run('node',['scripts/character-forge/render_upstream.mjs',workspace,'blockout']);
run('python3',['scripts/character-forge/review_upstream.py',...args,'--pass-id','blockout']);
run('python3',['scripts/character-forge/mark_golden_base_render.py',...args,'--source-head',process.env.HEAD_SHA]);
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
