import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PROTAGONIST_VILLAGER_FEMALE_MODEL as model,PROTAGONIST_VILLAGER_MODEL as male} from '../src/reference-model-catalog.js';
import {KAYKIT_MODEL_BY_KEY} from '../src/kaykit-foundation.js';
import {projectAssetUrl,PROJECT_ASSET_MAX_BYTES} from '../../assets/src/runtime-origin.js';
const root=new URL('../../../',import.meta.url),file=p=>fileURLToPath(new URL(p,root)),read=p=>readFileSync(file(p)),json=p=>JSON.parse(read(p));
const source=json('apps/review/public/library/provenance/female-protagonist-rogue-v1.json');
const derived=json('apps/review/public/library/provenance/heroine-dawn-v1.json');
const production=json('packages/characters/production/protagonist-villager-female-v1.production.json');
const bytes=read(derived.path),original=read(source.path),digest=(kind,value)=>createHash(kind).update(value).digest('hex');
const glb=body=>{const n=body.readUInt32LE(12);return{doc:JSON.parse(body.subarray(20,20+n)),binary:body.subarray(28+n)};};
const {doc,binary}=glb(bytes),upstream=glb(original),audit=json(derived.auditPath);
const payload=(g,b,i)=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView];return b.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};

test('female keeps its selection ID but resolves to an independent, self-hosted DCC heroine',()=>{
 assert.equal(model.id,'protagonist.villager.female.v1');assert.equal(model.sourceModelId,KAYKIT_MODEL_BY_KEY.rogue.id);assert.equal(model.modelingMode,'dcc-blender');assert.equal(model.procedural,false);
 assert.equal(model.assetPath,projectAssetUrl(derived.path.replace('apps/review/public/library/','')));assert.notEqual(model.assetPath,projectAssetUrl(source.path.replace('apps/review/public/library/','')));
 assert.equal(model.dccSourcePath,derived.dccSourcePath);assert.equal(production.source.meshPath,derived.path);assert.equal(derived.modified,true);assert.equal(model.referenceStyle.design,'protagonist-female-heroine-dawn');
});
test('the CC0 original and its license stay unmodified and independently pinned',()=>{
 assert.equal(source.author,'Kay Lousberg');assert.equal(source.license,'CC0-1.0');assert.equal(source.revision,KAYKIT_MODEL_BY_KEY.rogue.source.revision);assert.equal(original.length,3616284);
 assert.equal(digest('sha256',original),'e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d');assert.equal(digest('sha1',Buffer.concat([Buffer.from(`blob ${original.length}\0`),original])),'c8827661105eef7b2bfbef3bc676d41a47625733');
 assert.equal(derived.sourceSha256,source.sha256);assert.equal(derived.sourceGitBlobSha,source.gitBlobSha);assert.match(read(source.licensePath).toString(),/Creative Commons Zero, CC0/);assert.equal(digest('sha256',read(source.licensePath)),source.licenseSha256);
});
test('delivered GLB and editable .blend are real, bounded, embedded and integrity-matched',()=>{
 assert.equal(bytes.length,derived.bytes);assert.ok(bytes.length<PROJECT_ASSET_MAX_BYTES);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(digest('sha256',bytes),derived.sha256);assert.notEqual(derived.sha256,source.sha256);
 assert.equal(digest('sha1',Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])),derived.gitBlobSha);assert.ok(doc.buffers.every(b=>!b.uri));assert.ok(doc.images.every(i=>!i.uri&&Number.isInteger(i.bufferView)));
 assert.equal(digest('sha256',read(derived.dccSourcePath)),derived.dccSourceSha256);assert.ok(read(derived.dccSourcePath).length>100000);assert.equal(audit.sha256,derived.sha256);assert.ok(audit.triangles<10000);
});
test('all 76 motion streams, joint hierarchy and inverse binds survive byte-for-byte',()=>{
 assert.equal(doc.animations.length,76);assert.deepEqual(doc.animations,upstream.doc.animations);assert.deepEqual(doc.skins,upstream.doc.skins);assert.equal(doc.skins[0].joints.length,41);
 for(const i of doc.skins[0].joints)assert.deepEqual(doc.nodes[i],upstream.doc.nodes[i]);
 const indices=new Set([doc.skins[0].inverseBindMatrices]);
 for(const a of doc.animations)for(const s of a.samplers){indices.add(s.input);indices.add(s.output);}
 for(const i of indices){assert.deepEqual(doc.accessors[i],upstream.doc.accessors[i]);assert.deepEqual(payload(doc,binary,i),payload(upstream.doc,upstream.binary,i));}
 for(const name of ['Idle','Walking_A','1H_Melee_Attack_Chop','Block','Hit_A','PickUp','Lie_Idle','Death_A'])assert.ok(doc.animations.some(a=>a.name===name));
 assert.equal(model.production.target.rigId,'Rig_Medium');assert.equal(audit.samplerResampling,false);
});
test('identity changes are authored surfaces, not a recolor of the thief or a primitive replacement head',()=>{
 const nodes=new Map(doc.nodes.map(n=>[n.name,n]));
 for(const name of ['Heroine_Hair_RoundedBob','Heroine_Hair_SweptFringe','Heroine_Hair_TempleLock','Heroine_VillagePinafore','Heroine_Collar_L','Heroine_Collar_R','Heroine_RoseSash','Heroine_Hair_RoseBow_L','Heroine_BackWaistBow_L']){assert.ok(Number.isInteger(nodes.get(name)?.mesh),name);assert.equal(nodes.get(name).skin,0);}
 assert.equal(nodes.get('Rogue_Cape').mesh,undefined);
 for(const name of ['Rogue_Head','Rogue_Body','Rogue_ArmLeft','Rogue_ArmRight','Rogue_LegLeft','Rogue_LegRight'])assert.ok(Number.isInteger(nodes.get(name)?.mesh),name);
 const oldHead=upstream.doc.nodes.find(n=>n.name==='Rogue_Head');assert.notDeepEqual(doc.meshes[nodes.get('Rogue_Head').mesh],upstream.doc.meshes[oldHead.mesh]);
 assert.ok(model.production.authority.implementedModularParts.includes('kaykit-face-and-limbs'));
});
test('both consumers pin the same heroine and cannot revive the discarded old custom head',()=>{
 for(const app of ['rinne','character-studio']){
  const r=json(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json`);assert.equal(r.id,model.id);assert.equal(r.assetId,model.assetId);assert.equal(r.sha256,derived.sha256);assert.equal(r.gitBlobSha,derived.gitBlobSha);assert.equal(r.bytes,bytes.length);assert.equal(r.path,model.assetPath);assert.equal(r.humanoidRig,'kaykit.Rig_Medium.v1');assert.equal(r.license.spdx,'CC0-1.0');assert.equal(existsSync(file(`apps/${app}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.glb`)),false);
 }
 for(const p of ['assets/characters/protagonist/villager-female-v1/source/ProtagonistVillagerFemaleV1.blend','scripts/blender/build-protagonist-villager-female-v1.py','scripts/blender/refine-protagonist-villager-female-v1.py','docs/characters/references/protagonist-villager-female-v1.svg'])assert.equal(existsSync(file(p)),false,p);
});
test('real multi-angle and animation observations are bound to the shipped model, not human approval',()=>{
 const evidence=json(derived.runtimeEvidence);assert.equal(evidence.modelSha256,derived.sha256);assert.equal(evidence.beforeSha256,source.sha256);assert.equal(evidence.app,'apps/character-studio');assert.deepEqual(evidence.errors,[]);assert.equal(evidence.audit.audit.approved,true);
 const dir=derived.runtimeEvidence.replace(/receipt\.json$/,'');
 for(const view of ['front','three-quarter','side','back','face','mobile-390']){assert.ok(evidence.views.includes(view));const png=read(dir+view+'.png');assert.ok(png.length>10000);assert.equal(png.subarray(1,4).toString(),'PNG');}
 assert.equal(evidence.poses.length,6);for(const p of evidence.poses){assert.ok(p.changedBones>0);assert.ok(p.sampledVertices>100);assert.equal(p.clipCount,76);assert.ok(p.bounds.flat().every(Number.isFinite));}
 assert.equal(evidence.hardwareAcceptance,'not-measured');assert.equal(model.productionStage,'PRIMARY');assert.equal(production.stage,'PRIMARY');assert.equal(model.productionReady,false);assert.equal(model.visualApproval,'pending');assert.equal(production.status.productionReady,false);assert.equal(production.status.visualApproval,'pending');
 assert.equal(male.modelingMode,'dcc-blender');assert.equal(male.assetPath,'./simulator/assets/PROTAGONIST_VILLAGER_V1.glb');
});
test('bundled sample weapons stay excluded without changing attachment bones or owned equipment',()=>{
 assert.deepEqual(model.sourceDisplay.excludeMeshNodes,['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']);const joints=new Set(doc.skins.flatMap(s=>s.joints));
 for(const name of model.sourceDisplay.excludeMeshNodes){const i=doc.nodes.findIndex(n=>n.name===name);assert.ok(i>=0&&Number.isInteger(doc.nodes[i].mesh),name);assert.equal(joints.has(i),false);}
});
