import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {gitBlobSha,effectDependencies} from '../scripts/prepare-effects.mjs';

const SOURCE=Object.freeze({
  repository:'munokura/Effekseer-sample-for-RPG-Tkool-MZ',
  revision:'7faccfd4c769d49f56877950eb4b815846b952e5',
});
const GROUPS=new Set(['AndrewFM01','NextSoft01','Pierre01','Pierre02','Suzuki01','Tktk01','Tktk02','Tktk03']);

function selectedEffect(row){
  if(!GROUPS.has(row.path.split('/')[0])||!row.path.endsWith('.efkefc'))return false;
  if(row.path.startsWith('Tktk01/')&&/(Cure|hozyo)/i.test(row.path))return false;
  if(row.path==='Pierre01/Pierre01_Background.efkefc')return false;
  return true;
}

async function fetchBytes(item){
  const encoded=item.path.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(`https://raw.githubusercontent.com/${SOURCE.repository}/${SOURCE.revision}/${encoded}`,{signal:AbortSignal.timeout(30_000)});
  assert.equal(response.ok,true,`${item.path}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length,item.size,`${item.path}: byte length`);
  assert.equal(gitBlobSha(bytes),item.sha,`${item.path}: git blob`);
  return bytes;
}

test('discover genuine CC0 combat VFX closure',async()=>{
  const commitResponse=await fetch(`https://api.github.com/repos/${SOURCE.repository}/git/commits/${SOURCE.revision}`);
  assert.equal(commitResponse.ok,true,'source commit unavailable');
  const commit=await commitResponse.json();
  const treeResponse=await fetch(`https://api.github.com/repos/${SOURCE.repository}/git/trees/${commit.tree.sha}?recursive=1`);
  assert.equal(treeResponse.ok,true,'source tree unavailable');
  const tree=await treeResponse.json();
  assert.equal(tree.truncated,false,'source tree truncated');
  const entries=new Map(tree.tree.filter(row=>row.type==='blob').map(row=>[row.path,row]));
  const effects=[...entries.values()].filter(selectedEffect);
  assert.ok(effects.length>=100,`expected >=100 effects, got ${effects.length}`);
  assert.equal(new Set(effects.map(row=>row.sha)).size,effects.length,'duplicate effect blobs are not allowed');

  const closure=new Set(effects.map(row=>row.path));
  for(let start=0;start<effects.length;start+=8){
    await Promise.all(effects.slice(start,start+8).map(async effect=>{
      const bytes=await fetchBytes(effect);
      for(const dependency of effectDependencies(bytes)){
        const target=path.posix.join(path.posix.dirname(effect.path),dependency);
        assert.ok(entries.has(target),`${effect.path}: missing dependency ${target}`);
        closure.add(target);
      }
    }));
  }
  const files=[...closure].sort().map(p=>{const row=entries.get(p);return [row.path,row.size,row.sha];});
  console.log('RINNE_VFX_LIBRARY='+JSON.stringify({source:SOURCE,effectCount:effects.length,uniqueEffectBlobs:new Set(effects.map(row=>row.sha)).size,files}));
});
