/** Diagnose exact GLB and retain the genuine upstream hard stop. */
import {execFileSync} from 'node:child_process';
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit'});
const workspace='test-results/character-forge-upstream/upstream-scout',cache='.cache/character-forge-upstream';
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
run('python3',['-m','pip','install','-r','packages/assets/forge/requirements.txt']);
run('python3',['scripts/character-forge/restore_scout_artifact.py']);
run('npm',['ci','--ignore-scripts']);
run('npx',['playwright','install','--with-deps','chromium']);
run('node',['scripts/character-forge/diagnose_baked_albedo.mjs',workspace]);
run('python3',['scripts/character-forge/record_visual_rejection.py','--workspace',workspace,'--cache',cache,'--review','scripts/character-forge/fixtures/upstream-scout-material-r7-review.json']);
