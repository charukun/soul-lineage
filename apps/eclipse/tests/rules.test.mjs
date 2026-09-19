import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {manifest,excludedSnapshots} from '../model-manifest.mjs';
import {ensureDeliveryFixtures} from './ensure-fixtures.mjs';
import {WAVES,SKILLS,BLESSINGS,freshStats,waveEnemies,seededRandom,distance,clamp,clock,chooseAutoBlessing} from '../src/domain/rules.js';
ensureDeliveryFixtures();
test('five finite waves, exactly one boss, and a reachable end',()=>{assert.equal(WAVES.length,5);assert.equal(WAVES.flatMap((_,i)=>waveEnemies(i+1)).filter(t=>t==='boss').length,1);assert.equal(WAVES.reduce((n,w)=>n+w.count,0),73);assert.throws(()=>waveEnemies(0));});
test('three distinct skills have positive bounded cooldowns',()=>{assert.equal(SKILLS.length,3);for(const s of SKILLS){assert.ok(s.cooldown>0);assert.ok(s.damage>0);assert.ok(s.radius>0);}});
test('upgrades compose and healing never lowers maximum health',()=>{const s=freshStats();BLESSINGS.find(b=>b.id==='edge').apply(s);assert.equal(s.damage,1.25);BLESSINGS.find(b=>b.id==='flow').apply(s);assert.equal(s.cooldown,.8);s.hp=1;assert.equal(chooseAutoBlessing(s),'blood');BLESSINGS.find(b=>b.id==='blood').apply(s);assert.equal(s.hp,390);assert.equal(s.maxHp,390);});
test('seeded random replay is reproducible and bounds are correct',()=>{const a=seededRandom(31),b=seededRandom(31);for(let i=0;i<100;i++){const v=a();assert.equal(v,b());assert.ok(v>=0&&v<1);}assert.equal(distance({x:0,z:0},{x:3,z:4}),5);assert.equal(clamp(-5,0,2),0);assert.equal(clock(125),'02:05');});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const ordered=rows=>rows.map(({path,gitBlob,bytes})=>({path,gitBlob,bytes})).sort((a,b)=>a.path.localeCompare(b.path));
test('every acquired original and dependency is pinned, licensed and independently re-hashed',()=>{
 const acquired=JSON.parse(readFileSync(new URL('../public/models/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.length,22);assert.equal(acquired.length,manifest.length);
 for(const a of acquired){
  const expected=manifest.find(m=>m.id===a.id);assert.ok(expected);
  assert.equal(a.license,'CC0-1.0');assert.equal(a.sourcePath,expected.sourcePath);assert.equal(a.role,expected.role);
  assert.equal(a.revision,expected.revision);assert.match(a.revision,/^[a-f\d]{40}$/);assert.equal(a.repository,'agentkaerf/FreeModels');
  assert.match(a.sha256,/^[a-f\d]{64}$/);assert.match(a.gitBlob,/^[a-f\d]{40}$/);
  const bytes=readFileSync(new URL('../public/'+a.file,import.meta.url));assert.equal(bytes.length,a.bytes);assert.ok(a.bytes>0);
  assert.equal(sha256(bytes),a.sha256);assert.equal(gitBlob(bytes),a.gitBlob);
 }
 const audit=JSON.parse(readFileSync(new URL('../public/models/exclusion-audit.json',import.meta.url),'utf8'));
 assert.deepEqual(audit.collisions,[]);assert.equal(audit.generatedModels,0);assert.equal(audit.geometryRewrites,0);
 assert.ok(audit.sourceFiles.length>=acquired.length);
 for(const file of audit.sourceFiles){
  const path=file.sourcePath.split('/').map(encodeURIComponent).join('/');
  const bytes=readFileSync(new URL('../public/models/vendor/'+path,import.meta.url));
  assert.equal(bytes.length,file.bytes,file.sourcePath);assert.equal(sha256(bytes),file.sha256,file.sourcePath);assert.equal(gitBlob(bytes),file.gitBlob,file.sourcePath);
 }
 // Independently enumerate each exact Git tree. A guessed minimum count cannot prove completeness.
 const cwd=dirname(dirname(dirname(fileURLToPath(import.meta.url))));
 assert.deepEqual(Object.keys(audit.excludedSnapshots).sort(),excludedSnapshots.map(s=>s.ref).sort());
 const forbidden=new Set();
 for(const {ref,commit} of excludedSnapshots){
  const snapshot=audit.excludedSnapshots[ref];assert.equal(snapshot.commit,commit);
  try{execFileSync('git',['cat-file','-e',`${commit}^{commit}`],{cwd,stdio:'ignore'});}
  catch{execFileSync('git',['fetch','--depth=1','origin',commit],{cwd,stdio:'pipe',timeout:120000});}
  const tree=execFileSync('git',['ls-tree','-r','-l','-z',commit],{cwd,encoding:'utf8',maxBuffer:16*1024*1024});
  const actual=tree.split('\0').filter(Boolean).map(row=>{const tab=row.indexOf('\t'),parts=row.slice(0,tab).trim().split(/\s+/);return {path:row.slice(tab+1),gitBlob:parts[2],bytes:Number(parts[3])};}).filter(row=>/\.(glb|gltf|fbx|obj|vrm|blend)$/i.test(row.path));
  assert.ok(actual.length>0,`No existing model inventory for ${ref}`);
  assert.deepEqual(ordered(snapshot.models),ordered(actual),`Incomplete or stale exclusion inventory for ${ref}`);
  for(const model of actual)forbidden.add(model.gitBlob);
 }
 for(const asset of acquired)assert.equal(forbidden.has(asset.gitBlob),false,`Previously used model: ${asset.id}`);
});
test('no original procedural 3D models or primitive fallback',()=>{for(const file of readdirSync(new URL('../src/adapters',import.meta.url))){if(!file.endsWith('.js'))continue;const code=readFileSync(new URL('../src/adapters/'+file,import.meta.url),'utf8');assert.doesNotMatch(code,/new\s+(?:THREE\.)?(?:Box|Sphere|Cone|Cylinder|Plane|Torus|Capsule|Extrude|Lathe|Buffer)Geometry\s*\(/);}});
