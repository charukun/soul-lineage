/** Explicit task-only authoring transport. Not part of normal Fast DEV. */
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const run=(program,args)=>execFileSync(program,args,{stdio:'inherit'});
run('python3',['packages/assets/forge/upstream_engine.py','materialize','--key','harness']);
run('python3',['scripts/character-forge/verify_upstream.py']);
const out='test-results/character-forge-upstream';mkdirSync(out,{recursive:true});
run('python3',['scripts/character-forge/audit_targets.py','--out',out+'/adapter-target-discovery.json']);
const lock=JSON.parse(readFileSync('package-lock.json','utf8')).packages['node_modules/three'];
if(!/^https:\/\/registry\.npmjs\.org\/three\/-\/three-[0-9.]+\.tgz$/.test(lock.resolved))throw new Error('Unexpected Three.js source');
const response=await fetch(lock.resolved);if(!response.ok)throw new Error(`Three.js download failed: ${response.status}`);
const data=Buffer.from(await response.arrayBuffer()),integrity='sha512-'+createHash('sha512').update(data).digest('base64');
if(integrity!==lock.integrity)throw new Error('Three.js lock integrity mismatch');
writeFileSync(out+'/three.tgz',data);
writeFileSync(out+'/capability-probe.json',JSON.stringify({head:process.env.HEAD_SHA,stage:'authoring-materialization',three:lock,notVisualValidation:true}));
