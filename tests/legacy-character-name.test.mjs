import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const legacyName=String.fromCodePoint(0x53e1,0x667a,0x8c4a,0x6e80);

test('legacy character name is absent from tracked text files',()=>{
  const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const matches=[];
  for(const file of files){
    const data=readFileSync(file);
    if(data.includes(0)) continue;
    const text=data.toString('utf8');
    let count=0,index=0;
    while((index=text.indexOf(legacyName,index))!==-1){ count+=1; index+=legacyName.length; }
    if(count) matches.push({file,count});
  }
  assert.deepEqual(matches,[],`legacy character name remains: ${matches.map(({file,count})=>`${file} (${count})`).join(', ')}`);
});
