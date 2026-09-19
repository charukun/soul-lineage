import test from 'node:test';
import assert from 'node:assert/strict';

const SOURCE=Object.freeze({repository:'effekseer/EffectMaterials',revision:'8bf8edfedb51ac09af3d4cf788cb81746ea75a82'});
const EFFECTS=Object.freeze([
  ['Effects/ef_fire01.efkefc',13313,'71457a1e8fc3082c31b2c97f39c941b54346ad23'],
  ['Effects/ef_ice02.efkefc',91607,'44d2161fbe9648636191495018c9d7c3e670af60'],
  ['Effects/ef_lightning03.efkefc',67958,'897baed082d30597a0b1b76d7463e3084d9c6a3c'],
  ['Effects/ef_wind03.efkefc',28814,'440b9cd61f4d911f2356ed3d6340e3de420b78de'],
]);

function chunkInfo(bytes){
  const b=Buffer.from(bytes);
  assert.equal(b.toString('ascii',0,4),'EFKE');
  for(let p=8;p+8<=b.length;){
    const tag=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),end=p+8+size;
    assert.ok(end<=b.length);
    if(tag==='INFO')return b.subarray(p+8,end);
    p=end;
  }
  throw new Error('INFO missing');
}

test('probe EffectMaterials 1710 INFO dependency layout',async()=>{
  for(const [path,size] of EFFECTS){
    const encoded=path.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(`https://raw.githubusercontent.com/${SOURCE.repository}/${SOURCE.revision}/${encoded}`,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.ok,true);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length,size);
    const info=chunkInfo(bytes);
    console.log('EFFECTMATERIALS_INFO='+JSON.stringify({path,infoBytes:info.length,head:[...info.subarray(0,80)]}));
  }
});
