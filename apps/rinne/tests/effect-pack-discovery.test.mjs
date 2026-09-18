import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const WEBSITE_REV='c7cf8c7849c9536dda46f8493eb5c7b457cc896c';
const PACKS=[
  {name:'MAGICALxSPIRAL',path:'contributes/MAGICALxSPIRAL.zip',blob:'ab50f176b50b1b15b62be2371478935be90b286b'},
  {name:'tktk01',path:'contributes/tktk01.zip',blob:'7e256c2c9ebc75fefb8d14bc4dedfd5563fe4753'},
  {name:'tktk02',path:'contributes/tktk02.zip',blob:'ad93e73d7e154c407d605735c23afc416cb6f0df'},
];

function gitBlobSha(bytes){return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}
function zipEntries(bytes){
  const entries=[];
  for(let i=0;i+46<=bytes.length;){
    if(bytes.readUInt32LE(i)!==0x02014b50){i++;continue;}
    const nameLength=bytes.readUInt16LE(i+28);
    const extraLength=bytes.readUInt16LE(i+30);
    const commentLength=bytes.readUInt16LE(i+32);
    entries.push(bytes.subarray(i+46,i+46+nameLength).toString('utf8'));
    i+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}

test('inspect pinned CC0 Effekseer contribution packs',async()=>{
  for(const pack of PACKS){
    const url=`https://raw.githubusercontent.com/effekseer/effekseer.github.io/${WEBSITE_REV}/${pack.path}`;
    const response=await fetch(url,{signal:AbortSignal.timeout(60_000)});
    assert.equal(response.ok,true,`${pack.name}: HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(gitBlobSha(bytes),pack.blob,`${pack.name}: blob integrity`);
    const entries=zipEntries(bytes);
    const efkefc=entries.filter(name=>name.toLowerCase().endsWith('.efkefc'));
    const efkproj=entries.filter(name=>name.toLowerCase().endsWith('.efkproj'));
    const efk=entries.filter(name=>name.toLowerCase().endsWith('.efk'));
    console.log(JSON.stringify({pack:pack.name,total:entries.length,efkefc:efkefc.length,efkproj:efkproj.length,efk:efk.length,sample:[...efkefc,...efkproj,...efk].slice(0,12)}));
    assert.ok(entries.length>0,`${pack.name}: empty zip`);
  }
});
