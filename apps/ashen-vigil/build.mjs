import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
// Root workspace builds acquire the same audited sources as isolated builds.
if(!existsSync('public/assets-manifest.json'))execFileSync('python3',['prepare.py'],{stdio:'inherit'});
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
for(const name of ['index.html','style.css']) await cp(name,'dist/'+name);
await build({entryPoints:['src/main.js'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/game.js',minify:true,sourcemap:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest=JSON.parse(await readFile('public/assets-manifest.json','utf8'));
if(manifest.generatedModels!==0 || manifest.exclusionAudit.exactByteCollisions.length) throw Error('Asset policy failed');
await writeFile('dist/build.json',JSON.stringify({app:'ashen-vigil',version:'1.0.0',sha,builtAt:new Date().toISOString(),models:Object.keys(manifest.models).length,generatedModels:0},null,2));
await writeFile('dist/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/assets/*\n  Cache-Control: public, max-age=86400\n');
console.log('BUILD_OK',sha,Object.keys(manifest.models).length);
