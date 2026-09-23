/** Explicitly bounded DCC/centroid correction of the saved upstream stop. */
import {execFileSync} from 'node:child_process';
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit'});
const workspace='test-results/character-forge-upstream/upstream-scout',cache='.cache/character-forge-upstream';
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
run('python3',['-m','pip','install','-r','packages/assets/forge/requirements.txt']);
run('python3',['scripts/character-forge/restore_scout_artifact.py']);
run('python3',['scripts/character-forge/resume_scout.py','--workspace',workspace,'--cache',cache,'--policy','scripts/character-forge/fixtures/upstream-scout-resume-dcc.json']);
run('npm',['ci','--ignore-scripts']);
run('node',['--test','scripts/character-forge/uv-gutter.test.mjs','scripts/character-forge/reference-camera.test.mjs','scripts/character-forge/rig-adapter.test.mjs','packages/characters/tests/character-expressions.test.mjs','tests/character-forge-entrypoint.test.mjs','tests/character-create-forge.test.mjs']);
run('npx',['playwright','install','--with-deps','chromium']);
// Same exported GLB, camera and pixels; only the sampling interpolation changes.
run('node',['scripts/character-forge/diagnose_baked_albedo.mjs',workspace]);
// Existing repository headless Blender route (scripts/tools/hi3dgen/README.md).
run('sudo',['apt-get','update','-qq']);run('sudo',['apt-get','install','-y','blender']);
run('blender',['--background','--factory-startup','--python','scripts/blender/refine-forge-scout-hair.py','--','--workspace',workspace]);
run('blender',['--background',workspace+'/build/dcc/scout-refinement.blend','--python','scripts/blender/character-production-audit.py','--','--out',workspace+'/build/dcc/blender-audit.json','--character-id','upstream-scout']);
run('python3',['packages/assets/forge/upstream_workspace.py','mark','--workspace',workspace,'--','build-current-pass','--evidence','build/material-pass.ts','--evidence','build/dcc/refinement.json']);
run('node',['scripts/character-forge/render_upstream.mjs',workspace,'material-pass']);
run('python3',['packages/assets/forge/upstream_workspace.py','mark','--workspace',workspace,'--','render-capture','--evidence','review/material-pass/render-receipt.json']);
run('python3',['scripts/character-forge/review_upstream.py','--workspace',workspace,'--cache',cache,'--pass-id','material-pass']);
