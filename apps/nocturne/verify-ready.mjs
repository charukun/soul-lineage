import fs from 'node:fs';
const base=process.argv[2];
if(!base)throw Error('Public URL is required');
const expected=process.env.GITHUB_SHA;
const attempts=[];
fs.mkdirSync('evidence/public',{recursive:true});
let ready=false;
for(let attempt=1;attempt<=24;attempt++){
 const entry={attempt,at:new Date().toISOString()};
 try{
  const response=await fetch(new URL('build.json',base+'/'),{signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
  entry.status=response.status;
  if(response.status===401||response.status===403)throw Error('The public URL requires authorization');
  if(response.ok){
   const build=await response.json();entry.sourceSha=build.sourceSha;
   if(build.sourceSha===expected){
    const root=await fetch(base,{signal:AbortSignal.timeout(10000)});
    entry.rootStatus=root.status;
    ready=root.ok&&(await root.text()).includes('NOCTURNE');
   }
  }
 }catch(error){entry.error=String(error);}
 attempts.push(entry);console.log('PUBLIC_READINESS',JSON.stringify(entry));
 if(ready)break;
 await new Promise(resolve=>setTimeout(resolve,5000));
}
fs.writeFileSync('evidence/public/readiness.json',JSON.stringify({base,expected,ready,attempts},null,2));
if(!ready)throw Error('Exact public deployment was not ready within the bounded verification period');
