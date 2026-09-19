import test from 'node:test';
import assert from 'node:assert/strict';
import {effectDependencies} from '../scripts/prepare-effects.mjs';

const SOURCE=Object.freeze({repository:'effekseer/EffectMaterials',revision:'8bf8edfedb51ac09af3d4cf788cb81746ea75a82'});
const CASES=Object.freeze([
  ['Effects/ef_fire01.efkefc','Textures/tx_glow02_128.png'],
  ['Effects/ef_ice02.efkefc','Textures/tx_ice01_256.png'],
  ['Effects/ef_lightning03.efkefc','Textures/tx_lightning01_256.png'],
  ['Effects/ef_wind03.efkefc','Textures/tx_aura01_256.png'],
]);

test('reviewed Effekseer 1710 parser reads official dependent-file records',async()=>{
  for(const [path,expected] of CASES){
    const encoded=path.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(`https://raw.githubusercontent.com/${SOURCE.repository}/${SOURCE.revision}/${encoded}`,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.ok,true);
    const bytes=Buffer.from(await response.arrayBuffer());
    const dependencies=effectDependencies(bytes,1710);
    assert.ok(dependencies.includes(expected),`${path}: missing ${expected}`);
    assert.ok(dependencies.every(value=>!value.includes('\\')&&!value.includes('..')));
  }
});
