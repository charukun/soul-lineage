/** Task-only resume of the exact rejected reconstruction, without regenerating it. */
import {execFileSync} from 'node:child_process';
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit'});
const workspace='test-results/character-forge-upstream/upstream-scout',cache='.cache/character-forge-upstream';
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
run('python3',['-m','pip','install','-r','packages/assets/forge/requirements.txt']);
run('python3',['scripts/character-forge/restore_scout_artifact.py']);
run('python3',['scripts/character-forge/record_visual_rejection.py','--workspace',workspace,'--cache',cache,'--review','scripts/character-forge/fixtures/upstream-scout-material-r5-review.json']);
run('python3',['scripts/character-forge/author_scout_projection_masks.py','--workspace',workspace]);
run('npm',['ci','--ignore-scripts']);
run('node',['--test','scripts/character-forge/uv-gutter.test.mjs','scripts/character-forge/reference-camera.test.mjs','scripts/character-forge/rig-adapter.test.mjs','packages/characters/tests/character-expressions.test.mjs','tests/character-forge-entrypoint.test.mjs','tests/character-create-forge.test.mjs']);
run('npx',['playwright','install','--with-deps','chromium']);
// The actual r5 review requests refine-spec: regenerate only through pinned upstream.
run('python3',['scripts/character-forge/author_scout_side_hair.py','--workspace',workspace,'--cache',cache]);
run('python3',['packages/assets/forge/upstream_workspace.py','run','--workspace',workspace,'--entry','forge/stage3_build/generate_threejs_factory.py','--','object-sculpt-spec.json','--pass-id','material-pass','--out','build/material-pass.ts','--force']);
run('python3',['packages/assets/forge/upstream_workspace.py','mark','--workspace',workspace,'--','build-current-pass','--evidence','build/material-pass.ts','--evidence','img2threejs/evidence/side-hair-refinement.json']);
run('node',['scripts/character-forge/render_upstream.mjs',workspace,'material-pass']);
run('python3',['packages/assets/forge/upstream_workspace.py','mark','--workspace',workspace,'--','render-capture','--evidence','review/material-pass/render-receipt.json']);
run('python3',['scripts/character-forge/review_upstream.py','--workspace',workspace,'--cache',cache,'--pass-id','material-pass']);
