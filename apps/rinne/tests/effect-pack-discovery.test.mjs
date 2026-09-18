import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {execFileSync} from 'node:child_process';

const WEBSITE_REV='c7cf8c7849c9536dda46f8493eb5c7b457cc896c';
const TOOL={url:'https://github.com/effekseer/Effekseer/releases/download/1806/Effekseer1.80.6Linux.zip',size:97973843,sha256:'ca90272844175efc985e068d31c488b97898248e451e4ec44b4988fdf5d53928'};
const PACK={path:'contributes/MAGICALxSPIRAL.zip',blob:'ab50f176b50b1b15b62be2371478935be90b286b'};
const EFFECTS=['AquaPoint.efkproj','Attack_Impact.efkproj','Attack1.efkproj'];

async function download(url,target){
  const response=await fetch(url,{signal:AbortSignal.timeout(120_000),redirect:'follow'});
  assert.equal(response.ok,true,`HTTP ${response.status}: ${url}`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(target));
}
function gitBlobSha(bytes){return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}
async function find(root,name){
  for(const item of await readdir(root,{withFileTypes:true})){
    const full=path.join(root,item.name);
    if(item.isDirectory()){const hit=await find(full,name);if(hit)return hit;}
    else if(item.name===name)return full;
  }
  return null;
}

test('official CLI upgrades distinct CC0 contribution effects to efkefc',async()=>{
  const root=path.join(tmpdir(),`rinne-vfx-probe-${randomUUID()}`);
  await mkdir(root,{recursive:true});
  try{
    const toolZip=path.join(root,'tool.zip');
    await download(TOOL.url,toolZip);
    const toolBytes=await readFile(toolZip);
    assert.equal(toolBytes.length,TOOL.size);
    assert.equal(createHash('sha256').update(toolBytes).digest('hex'),TOOL.sha256);
    const toolRoot=path.join(root,'tool');await mkdir(toolRoot);
    execFileSync('unzip',['-q',toolZip,'-d',toolRoot]);
    const executable=await find(toolRoot,'Effekseer');assert.ok(executable,'Effekseer executable missing');
    execFileSync('chmod',['+x',executable]);

    const packZip=path.join(root,'pack.zip');
    await download(`https://raw.githubusercontent.com/effekseer/effekseer.github.io/${WEBSITE_REV}/${PACK.path}`,packZip);
    const packBytes=await readFile(packZip);assert.equal(gitBlobSha(packBytes),PACK.blob);
    const packRoot=path.join(root,'pack');await mkdir(packRoot);
    execFileSync('unzip',['-q',packZip,'-d',packRoot]);

    const results=[];
    for(const name of EFFECTS){
      const source=await find(packRoot,name);assert.ok(source,`missing ${name}`);
      const output=path.join(path.dirname(source),name.replace(/\.efkproj$/i,'.efkefc'));
      execFileSync(executable,['-cui','-in',source,'-o',output],{cwd:path.dirname(source),stdio:'pipe',timeout:60_000});
      const bytes=await readFile(output);
      assert.ok(bytes.length>128,`${name}: empty converted output`);
      assert.equal(bytes.subarray(0,4).toString('ascii'),'EFKE',`${name}: invalid efkefc header`);
      results.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
    console.log(JSON.stringify({converted:results}));
  }finally{await rm(root,{recursive:true,force:true});}
});
