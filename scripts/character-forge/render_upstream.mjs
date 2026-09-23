/** Browser authoring adapter: execute the unmodified upstream factory and capture evidence. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
const [workspaceArg,pass='blockout']=process.argv.slice(2),workspace=resolve(workspaceArg||''),repo=resolve(import.meta.dirname,'../..');
if(!workspaceArg)throw Error('Usage: render_upstream.mjs WORKSPACE PASS');
const typescript=await readFile(join(workspace,'build',pass+'.ts'),'utf8');
const factory=stripTypeScriptTypes(typescript,{mode:'transform'});
const functionName=/export function (create\w+Model)\(/.exec(factory)?.[1];
if(!functionName)throw Error('No upstream factory export');
await writeFile(join(workspace,'build',pass+'.js'),factory);
const out=join(workspace,'review',pass);await mkdir(out,{recursive:true});
const app=`import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {${functionName}} from './build/${pass}.js';
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(540,1080);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
let loading=false;THREE.DefaultLoadingManager.onStart=()=>loading=true;THREE.DefaultLoadingManager.onLoad=()=>loading=false;THREE.DefaultLoadingManager.onError=url=>errors.push('texture load: '+url);
const model=${functionName}({textureSize:1024,qualityPriority:'reference-fidelity'});scene.add(model);
scene.add(new THREE.HemisphereLight(0xffffff,0x80909a,1.2));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(2,4,3);scene.add(key);const rim=new THREE.DirectionalLight(0xffffff,.5);rim.position.set(-2,2,-3);scene.add(rim);
const cameras=await (await fetch('img2threejs/evidence/cameras.json')).json();
const camera=new THREE.PerspectiveCamera(10,.5,.01,100);
const mats=new Map();model.traverse(n=>{if(n.isMesh){mats.set(n,n.material);if(n.material.opacity===0)n.visible=false;else if('${pass}'==='blockout')n.material=new THREE.MeshStandardMaterial({color:0xbfcbd5,roughness:.85});}});
const rotations={front:0,side:-Math.PI/2,back:Math.PI,front34:-Math.PI/4,rear34:-3*Math.PI/4,oppositeSide:Math.PI/2};
function draw(view='front') {const c=cameras[view]||cameras.front,p=c.fit.cameraParameters;camera.fov=p.fovDegrees;camera.position.fromArray(p.position);camera.rotation.set(0,0,0);camera.updateProjectionMatrix();model.rotation.y=rotations[view]??0;model.updateMatrixWorld(true);renderer.render(scene,camera);}
function meshBuffers(){const rows=[];model.updateMatrixWorld(true);model.traverse(n=>{if(n.isMesh&&n.visible){const g=n.geometry;rows.push({name:n.name,position:Array.from(g.attributes.position.array),normal:g.attributes.normal?Array.from(g.attributes.normal.array):[],uv:g.attributes.uv?Array.from(g.attributes.uv.array):[],index:g.index?Array.from(g.index.array):[],matrixWorld:n.matrixWorld.toArray()});}});return rows;}
window.forge={draw,meshBuffers,async exportGLB(){model.rotation.y=0;model.updateMatrixWorld(true);const data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});return Array.from(new Uint8Array(data));},snapshot(){const rows=meshBuffers();return {errors,pass:'${pass}',parts:rows.map(r=>({name:r.name,vertices:r.position.length/3,triangles:r.index.length?r.index.length/3:r.position.length/9})),bounds:new THREE.Box3().setFromObject(model).toArray?.()||null};}};
for(let i=0;i<200&&loading;i++)await new Promise(r=>setTimeout(r,50));if(loading)throw Error('Material loading did not finish');draw();window.ready=true;`;
const pageHTML=`<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/build/three.module.js","three/addons/":"/vendor/examples/jsm/"}}</script><script type="module" src="/author.js"></script>`;
const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(pageHTML);return;}
  if(pathname==='/author.js'){res.setHeader('Content-Type','text/javascript');res.end(app);return;}
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const base=pathname.startsWith('/vendor/')?join(repo,'node_modules/three'):workspace;
  const file=resolve(base,pathname.replace(/^\/vendor\//,'').replace(/^\//,''));
  if(!file.startsWith(base+'/'))throw Error('Path escape');
  res.setHeader('Content-Type',({'.js':'text/javascript','.png':'image/png','.json':'application/json'}[extname(file)]||'application/octet-stream'));
  res.end(await readFile(file));
}catch(e){res.writeHead(404);res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright/index.mjs':'@playwright/test');
 browser=await chromium.launch({executablePath:process.env.CHARACTER_FORGE_CHROMIUM||undefined,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:540,height:1080}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('FORGE_PAGE_ERROR '+e.stack);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('FORGE_CONSOLE_ERROR '+m.text());}});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
 try{await page.waitForFunction(()=>window.ready,null,{timeout:60000});}
 catch(error){await writeFile(join(out,'browser-failure.json'),JSON.stringify({errors,message:error.message},null,2));await page.screenshot({path:join(out,'browser-failure.png')});throw error;}
 for(const view of ['front','side','back','front34','rear34','oppositeSide']){await page.evaluate(view=>window.forge.draw(view),view);await page.locator('canvas').screenshot({path:join(out,view+'.png')});}
 const receipt=await page.evaluate(()=>window.forge.snapshot());receipt.errors.push(...errors);receipt.factorySha256=createHash('sha256').update(typescript).digest('hex');receipt.sourceHead=process.env.HEAD_SHA||null;receipt.visualApproval='pending';
 await page.evaluate(()=>window.forge.draw('front'));
 await writeFile(join(out,'mesh-buffers.json'),JSON.stringify(await page.evaluate(()=>window.forge.meshBuffers())));
 await writeFile(join(workspace,'build',pass+'.glb'),Buffer.from(await page.evaluate(()=>window.forge.exportGLB())));
 await writeFile(join(out,'render-receipt.json'),JSON.stringify(receipt,null,2));
 if(receipt.errors.length)throw Error(JSON.stringify(receipt.errors));
 console.log(JSON.stringify({pass,parts:receipt.parts.length,triangles:receipt.parts.reduce((n,p)=>n+p.triangles,0),output:out,visualApproval:'pending'}));
}finally{await browser?.close();server.close();}
