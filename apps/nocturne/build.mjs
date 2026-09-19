import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const files=['engine','forest','actors','combat','rules','simulation','effects','runtime'];
const source=files.map(name=>fs.readFileSync(`src/${name}.js`,'utf8')).join('\n');
if(/new\s+(?:THREE\.)?(?:Box|Sphere|Plane|Cylinder|Cone|Torus|Buffer|Shape|Extrude)Geometry\s*\(/.test(source))throw Error('Generated model geometry is prohibited');
fs.mkdirSync('public/qa',{recursive:true});
fs.rmSync('public/vendor',{recursive:true,force:true});
fs.cpSync('node_modules/three/build','public/vendor/three/build',{recursive:true});
fs.cpSync('node_modules/three/examples/jsm','public/vendor/three/examples/jsm',{recursive:true});
fs.writeFileSync('public/main.js',source);
fs.copyFileSync('index.html','public/index.html');
fs.writeFileSync('public/style.css',['style.css','hud.css','mobile.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n'));
execFileSync(process.execPath,['--check','public/main.js'],{stdio:'inherit'});
const manifest=JSON.parse(fs.readFileSync('public/assets-manifest.json','utf8'));
if(manifest.generatedModels!==0)throw Error('Unexpected generated models');
for(const [key,model] of Object.entries(manifest.models)){
 const bytes=fs.readFileSync(path.join('public',model.url));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hash!==model.sha256)throw Error('Original asset changed: '+key);
}
for(const pack of manifest.packs){if(pack.license!=='CC0-1.0')throw Error('Unapproved license');}
fs.copyFileSync('node_modules/three/LICENSE','public/THREE-LICENSE.txt');
const build={name:'NOCTURNE',subtitle:'灰の誓約',sourceSha:process.env.GITHUB_SHA||'local',builtAt:new Date().toISOString(),engine:'Three.js 0.180.0 / WebGL2',externalModels:Object.keys(manifest.models).length,generatedModels:0,sourceFiles:files.map(n=>`src/${n}.js`),validation:'See qa/report.json for executed browser checks',referenceQuality:'Target reference, not a claim of exact visual equivalence'};
fs.writeFileSync('public/build.json',JSON.stringify(build,null,2));
fs.writeFileSync('public/_headers','/assets/*\n  Cache-Control: public, max-age=86400\n/vendor/*\n  Cache-Control: public, max-age=86400\n/build.json\n  Cache-Control: no-store\n/main.js\n  Cache-Control: no-cache\n');
console.log('BUILD_OK',JSON.stringify(build));
