import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {additionalAssets} from '../additional-assets.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),out=resolve(root,'public/models');
const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const manifest=JSON.parse(await readFile(resolve(out,'manifest.json'),'utf8')).filter(m=>!additionalAssets.some(a=>a.id===m.id));
const audit=JSON.parse(await readFile(resolve(out,'exclusion-audit.json'),'utf8'));
const forbidden=new Set(Object.values(audit.excludedSnapshots).flatMap(s=>s.models.map(m=>m.gitBlob)));
for(const source of additionalAssets){
  let bytes;
  const local=process.env.ECLIPSE_COMPATIBLE_MOTION;
  if(local)bytes=await readFile(resolve(local,'UAL1_Standard.glb'));
  else for(let attempt=0;attempt<4;attempt++){
    try{const r=await fetch(source.sourceUrl,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error(`HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());break;}
    catch(error){if(attempt===3)throw error;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
  }
  if(sha256(bytes)!==source.expectedSHA256||gitBlob(bytes)!==source.expectedGitBlob)throw Error('Original motion integrity failure');
  if(forbidden.has(gitBlob(bytes)))throw Error('Excluded-game animation mannequin source collision');
  const file='models/vendor/'+source.sourcePath;await mkdir(dirname(resolve(root,'public',file)),{recursive:true});await writeFile(resolve(root,'public',file),bytes);
  const record={...source,file,source:source.sourceUrl,bytes:bytes.length,sha256:sha256(bytes),gitBlob:gitBlob(bytes)};
  manifest.find(m=>m.id==='RangerAnimations').additionalMotion=record;
  audit.newModels=audit.newModels.filter(m=>m.id!==record.id);audit.sourceFiles=audit.sourceFiles.filter(f=>f.sourcePath!==record.sourcePath);
  audit.newModels.push(record);audit.sourceFiles.push({sourcePath:source.sourcePath,sourceUrl:source.sourceUrl,bytes:bytes.length,sha256:record.sha256,gitBlob:record.gitBlob});
}
audit.additionalSources=additionalAssets;audit.textureDelivery='Downscaled WebP derivatives only. Original model files, geometry, buffers and source images remain unchanged.';
await writeFile(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(out,'exclusion-audit.json'),JSON.stringify(audit,null,2)+'\n');
await appendFile(resolve(out,'CREDITS.txt'),'Additional original UAL1 animation clips: Quaternius, CC0. Distribution registered at https://godotengine.org/asset-library/asset/5235\n'+additionalAssets.map(a=>a.sourceUrl).join('\n')+'\nTexture delivery uses resized WebP derivatives of the credited original artwork. No 3D geometry was generated or rewritten.\n');
let python=process.env.PYTHON||'python3';
if(spawnSync(python,['-c','import PIL'],{stdio:'ignore'}).status!==0){
  const env=resolve(root,'.cache/image-python');execFileSync(python,['-m','venv',env],{stdio:'inherit'});
  python=resolve(env,process.platform==='win32'?'Scripts/python.exe':'bin/python');
  execFileSync(python,['-m','pip','install','--disable-pip-version-check','Pillow==11.3.0'],{stdio:'inherit'});
}
execFileSync(python,[resolve(root,'tools/optimize-textures.py'),out],{stdio:'inherit'});
