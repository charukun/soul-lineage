import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const repository='KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0';
const revision='b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07';
const root='addons/kaykit_dungeon_remastered/Assets/gltf/';
const sourceBase=`https://raw.githubusercontent.com/${repository}/${revision}/`;
const maxBytes=20*1024*1024;
const assets=[
  ['banner-shield-red','banner_shield_red.gltf.glb',55104,'7e81382d8c57efce6fa89a0c8785eab15ab9576b'],
  ['barrel-large-decorated','barrel_large_decorated.gltf.glb',73628,'dd8b97dde32e6b1a08b217ef0c640b1d7c93f283'],
  ['bed-decorated','bed_decorated.gltf.glb',94688,'b7195b9fad17836ed2140f5ae15f45bb118e87e1'],
  ['box-small-decorated','box_small_decorated.gltf.glb',72748,'7ce90474db9145edd27aa7a46447cb9812d7ea3b'],
  ['candle-triple','candle_triple.gltf.glb',28240,'c8c7e63300d6b689607be6f13d828348f0ecc2e6'],
  ['chair','chair.gltf.glb',36252,'d714e3eace33b64d3a2190025a57dd9762e50a6f'],
  ['chest','chest.glb',81412,'534c76a794d4b531a91619871845e92e3ca6e432'],
  ['chest-gold','chest_gold.glb',140140,'8dd05d691d4954009c94b9bb052e56db5c4f3432'],
  ['coin-stack-large','coin_stack_large.gltf.glb',101076,'a806b1238fbd21299a8f2a1a06eab6486dbcaad2'],
  ['crates-stacked','crates_stacked.gltf.glb',103704,'7f273be5ebd143b58135ecc1d061d22a633cad92'],
  ['keg-decorated','keg_decorated.gltf.glb',142052,'6420a0e39f8d76005cdbf3471e6de799099937b3'],
  ['keyring-hanging','keyring_hanging.gltf.glb',49108,'51c110f8f77e4b49b4fb1a856c57cf060d6b9884'],
];

const gitBlob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function verifyGlb(bytes,id){
  if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error(`invalid GLB header: ${id}`);
  let offset=12,json=null;
  while(offset<bytes.length){const len=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);offset+=8;if(len%4||offset+len>bytes.length)throw new Error(`invalid GLB chunk: ${id}`);if(type===0x4e4f534a&&!json)json=JSON.parse(bytes.subarray(offset,offset+len).toString('utf8'));offset+=len;}
  if(json?.asset?.version!=='2.0')throw new Error(`not glTF 2.0: ${id}`);
  const external=[...(json.buffers||[]),...(json.images||[])].map(v=>v.uri).filter(Boolean);
  if(external.length)throw new Error(`external GLB dependency: ${id}`);
}
async function fetchBytes(relative,expectedBytes,expectedBlob){
  const response=await fetch(sourceBase+relative,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${relative}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==expectedBytes||bytes.length>maxBytes)throw new Error(`byteLength mismatch: ${relative}`);
  const blob=gitBlob(bytes);if(blob!==expectedBlob)throw new Error(`git blob mismatch: ${relative}`);
  return bytes;
}
const manifestPath='apps/review/public/library/manifest.json';
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const provenanceFiles=[];
for(const [id,file,byteLength,gitBlobSha] of assets){
  const bytes=await fetchBytes(root+file,byteLength,gitBlobSha);verifyGlb(bytes,id);
  const output=`object/kaykit-dungeon/${id}/${gitBlobSha}.glb`;
  const target=path.join('apps/review/public/library',output);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
  const digest=sha256(bytes);
  manifest.files=manifest.files.filter(row=>row.path!==output);
  manifest.files.push({path:output,bytes:bytes.length,gitBlobSha,sha256:digest});
  provenanceFiles.push({id,sourcePath:root+file,runtimePath:output,byteLength:bytes.length,gitBlobSha,sha256:digest});
}
const licenseBytes=await fetchBytes('LICENSE.txt',829,'686cf4ee3931b75d4ecfac6308f9d3287553748c');
await mkdir('apps/review/public/library/licenses',{recursive:true});
await writeFile('apps/review/public/library/licenses/KayKit-Dungeon-Remastered-1.0-CC0.txt',licenseBytes);
manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
await mkdir('apps/review/public/library/provenance',{recursive:true});
await writeFile('apps/review/public/library/provenance/kaykit-dungeon-curation-20260920.json',JSON.stringify({
  schema:1,active:true,category:'object-model',repository,revision,author:'Kay Lousberg',license:'CC0-1.0',
  licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
  originalSource:'https://kaylousberg.itch.io/kaykit-dungeon-remastered',
  sourceRepository:'https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0',
  runtimeOrigin:'https://soul-lineage-review-dev.c-okamoto.workers.dev/library/',
  files:provenanceFiles
},null,2)+'\n');
console.log(`materialized ${provenanceFiles.length} KayKit Dungeon assets`);
