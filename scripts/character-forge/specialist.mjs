/** Explicit task-only authoring transport. Not part of normal Fast DEV. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit'});
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
mkdirSync('test-results/character-forge-upstream',{recursive:true});
run('tar',['-czf','test-results/character-forge-upstream/eligible-fixtures.tar.gz','packages/assets/characters/forge','packages/rendering/src/kaykit-rig.js']);
writeFileSync('test-results/character-forge-upstream/capability-probe.json',JSON.stringify({head:process.env.HEAD_SHA,stage:'authoring-materialization',notVisualValidation:true}));
