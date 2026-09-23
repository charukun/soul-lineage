/** Browser authoring adapter: execute the unmodified upstream factory and capture evidence. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [workspaceArg,pass='blockout',mode]=process.argv.slice(2),workspace=resolve(workspaceArg||''),repo=resolve(import.meta.dirname,'../..');
if(!workspaceArg)throw Error('Usage: render_upstream.mjs WORKSPACE PASS');
if(mode&&mode!=='--projection-diagnostic')throw Error('Unknown render mode');
const projectionDiagnostic=mode==='--projection-diagnostic';
if(projectionDiagnostic&&pass!=='blockout')throw Error('Projection diagnostic is scoped to an unaccepted blockout');
const captureId=projectionDiagnostic?pass+'-projection-diagnostic':pass;
const typescript=await readFile(join(workspace,'build',pass+'.ts'),'utf8');
const factory=stripTypeScriptTypes(typescript,{mode:'transform'});
const functionName=/export function (create\w+Model)\(/.exec(factory)?.[1];
if(!functionName)throw Error('No upstream factory export');
await writeFile(join(workspace,'build',pass+'.js'),factory);
const out=join(workspace,'review',captureId);await mkdir(out,{recursive:true});
const dccFile=join(workspace,'build/dcc/refined-hair.json');
const dccBytes=await readFile(dccFile).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const dccAuthorityFactory=dccBytes?createHash('sha256').update(await readFile(join(workspace,'build/material-pass.ts'))).digest('hex'):null;
const geometryRefinements=dccBytes?[{path:'build/dcc/refined-hair.json',sha256:createHash('sha256').update(dccBytes).digest('hex')}]:[];
const app=`import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {applyReferenceCamera} from '/adapters/reference_camera.js';
import {bakeReferenceProjection} from '/adapters/three_projection_bake.js';
import {${functionName}} from './build/${pass}.js';
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(540,1080);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
let loading=false;THREE.DefaultLoadingManager.onStart=()=>loading=true;THREE.DefaultLoadingManager.onLoad=()=>loading=false;THREE.DefaultLoadingManager.onError=url=>errors.push('texture load: '+url);
const model=${functionName}({textureSize:1024,qualityPriority:'reference-fidelity'});scene.add(model);
const hemi=new THREE.HemisphereLight(0xffffff,0x80909a,1.2);scene.add(hemi);const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(2,4,3);scene.add(key);const rim=new THREE.DirectionalLight(0xffffff,.5);rim.position.set(-2,2,-3);scene.add(rim);
const cameras=await (await fetch('img2threejs/evidence/cameras.json')).json();
const diagnosticOnly=${projectionDiagnostic};
const projected=diagnosticOnly||!['blockout','structural-pass','form-refinement'].includes('${pass}');
if(diagnosticOnly)model.traverse(n=>{if(n.isMesh&&!['head','chest'].includes(n.userData.sculptComponent?.id))n.visible=false;});
const spec=await (await fetch('object-sculpt-spec.json')).json();
const refinements=${JSON.stringify(geometryRefinements)};
for(const entry of refinements){
 const data=await(await fetch(entry.path)).json();
 if(data.schema!=='rinne.dcc-refined-mesh/v1'||data.componentId!=='hair'||data.sourceFactorySha256!==${JSON.stringify(dccAuthorityFactory)})throw Error('DCC geometry belongs to another upstream source factory');
 const component=spec.componentTree.find(n=>n.id===data.componentId);
 if(JSON.stringify(component.geometryDescriptor)!==JSON.stringify(data.sourceGeometryDescriptor)||JSON.stringify(component.transform)!==JSON.stringify(data.sourceTransform))throw Error('Upstream hair spec changed after DCC refinement');
 let target;model.traverse(n=>{if(n.isMesh&&n.userData.sculptComponent?.id===data.componentId)target=n;});if(!target||target.name!==data.name)throw Error('DCC component missing');
 if(data.position.length!==data.normal.length||data.position.some(v=>!Number.isFinite(v))||data.normal.some(v=>!Number.isFinite(v)))throw Error('Invalid DCC buffers');
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(data.position.length/3*2),2));geometry.setIndex(data.index);geometry.computeBoundingBox();geometry.computeBoundingSphere();target.geometry.dispose();target.geometry=geometry;
}
if(projected&&!spec.projectionBake?.required)throw Error('Material passes require an explicit upstream projection/bake plan');
const camera=new THREE.PerspectiveCamera(10,.5,.01,100);
const mats=new Map();model.traverse(n=>{if(n.isMesh){mats.set(n,n.material);if(n.material.opacity===0)n.visible=false;else if(!diagnosticOnly&&['blockout','structural-pass','form-refinement'].includes('${pass}'))n.material=new THREE.MeshStandardMaterial({color:0xbfcbd5,roughness:.85});}});
const rotations={front:0,side:-Math.PI/2,back:Math.PI,front34:-Math.PI/4,rear34:-3*Math.PI/4,oppositeSide:Math.PI/2};
function draw(view='front') {const c=cameras[view]||cameras.front,p=c.fit.cameraParameters;camera.fov=p.fovDegrees;camera.position.fromArray(p.position);camera.rotation.set(0,0,0);camera.updateProjectionMatrix();if(projected)applyReferenceCamera(THREE,camera,c);model.rotation.y=rotations[view]??0;model.updateMatrixWorld(true);renderer.render(scene,camera);}
function light(mode){
 const reference=spec.referenceReviewLighting;
 if(projected&&reference){
  renderer.toneMapping=reference.toneMapping==='none'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=reference.exposure;
  hemi.color.set(reference.hemisphere.sky);hemi.groundColor.set(reference.hemisphere.ground);hemi.intensity=reference.hemisphere.intensity;
  for(const [lamp,setting]of [[key,reference.key],[rim,reference.rim]]){lamp.color.set(setting.color);lamp.intensity=setting.intensity;lamp.position.fromArray(setting.position);lamp.target.position.fromArray(setting.target);}
  if(mode==='neutral'){hemi.intensity=Math.PI;key.intensity=rim.intensity=0;}
  if(mode==='grazing'){hemi.intensity=.4;key.intensity=3;key.position.set(-4,2,1);rim.intensity=.5;}
  return;
 }
 hemi.intensity=mode==='neutral'?2:mode==='grazing'?.4:1.2;hemi.groundColor.set(mode==='neutral'?0xffffff:0x80909a);key.intensity=mode==='neutral'?0:mode==='grazing'?3:2;key.position.set(...(mode==='grazing'?[-4,2,1]:[2,4,3]));rim.intensity=mode==='neutral'?0:.5;
}
function meshBuffers(){const rows=[];model.updateMatrixWorld(true);model.traverse(n=>{if(n.isMesh&&n.visible){const g=n.geometry;rows.push({name:n.name,position:Array.from(g.attributes.position.array),normal:g.attributes.normal?Array.from(g.attributes.normal.array):[],uv:g.attributes.uv?Array.from(g.attributes.uv.array):[],index:g.index?Array.from(g.index.array):[],matrixWorld:n.matrixWorld.toArray()});}});return rows;}
window.forge={draw,meshBuffers,light,projected,
 partIds(view){
  const saved=new Map(),rows=[];let index=0;
  model.traverse(n=>{if(n.isMesh&&n.visible){const rgb=[32+(index%4)*48,32+(Math.floor(index/4)%4)*48,64+Math.floor(index/16)*64];index++;saved.set(n,n.material);n.material=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...rgb.map(c=>c/255),THREE.SRGBColorSpace),toneMapped:false});rows.push({name:n.name,componentId:n.userData.sculptComponent?.id,rgb});}});
  draw(view);for(const [n,m]of saved){n.material.dispose();n.material=m;}return rows;
 },
 stripped(){const saved=new Map();model.traverse(n=>{if(n.isMesh&&n.visible){saved.set(n,n.material);n.material=new THREE.MeshStandardMaterial({color:0xbfcbd5,roughness:.85});}});draw('front');for(const [n,m]of saved){n.material.dispose();n.material=m;}},
 closeup(){light('grazing');model.rotation.y=0;applyReferenceCamera(THREE,camera,cameras.front);camera.position.set(1.7,1.3,3);camera.fov=18;camera.lookAt(0,1.24,0);camera.updateProjectionMatrix();renderer.render(scene,camera);},
 async bake(){const maps=await(await fetch('img2threejs/evidence/projection/maps.json')).json();const outputs=await bakeReferenceProjection(THREE,renderer,model,cameras,maps,{physicalChannels:spec.projectionBake.physicalChannelApplication?.policy,surfaceResponses:spec.projectionBake.surfaceResponses});for(const row of outputs){const slug=row.mesh.toLowerCase().replace(/[^a-z0-9]+/g,'-');for(const [channel,data]of Object.entries(row.files)){const filename=slug+'-'+channel+'.png',body=await(await fetch(data)).arrayBuffer();const response=await fetch('/capture/texture/'+filename,{method:'POST',body});if(!response.ok)throw Error('Texture transport failed');row.files[channel]='build/textures/${captureId}/'+filename;}}return {status:'pixels-baked; visual approval pending',authority:'pinned upstream descriptors and camera fit',outputs};},
 async exportGLB(){
 model.rotation.y=0;model.updateMatrixWorld(true);
 // sculptRuntime owns live Three.js nodes, not glTF JSON extras. Serializing
 // those repeated scene graphs exhausts memory. Geometry/materials stay intact.
 const metadata=new Map();model.traverse(n=>{metadata.set(n,n.userData);n.userData={};});
 try{const data=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
 const response=await fetch('/capture/model.glb',{method:'POST',body:data});if(!response.ok)throw Error('GLB transport failed');return data.byteLength;
 }finally{for(const [node,data] of metadata)node.userData=data;}
},snapshot(){const rows=meshBuffers(),box=new THREE.Box3(),point=new THREE.Vector3();for(const r of rows){const matrix=new THREE.Matrix4().fromArray(r.matrixWorld);for(let i=0;i<r.position.length;i+=3)box.expandByPoint(point.fromArray(r.position,i).applyMatrix4(matrix));}return {errors,geometryRefinements:refinements,pass:'${pass}',parts:rows.map(r=>({name:r.name,vertices:r.position.length/3,triangles:r.index.length?r.index.length/3:r.position.length/9})),bounds:{min:box.min.toArray(),max:box.max.toArray()}};}};
for(let i=0;i<200&&loading;i++)await new Promise(r=>setTimeout(r,50));if(loading)throw Error('Material loading did not finish');window.ready=true;`;
const pageHTML=`<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/build/three.module.js","three/addons/":"/vendor/examples/jsm/","three/examples/jsm/":"/vendor/examples/jsm/"}}</script><script type="module" src="/author.js"></script>`;
const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(req.method==='POST'&&pathname==='/capture/model.glb'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>256*1024*1024)throw Error('GLB transport limit');chunks.push(chunk);}
    await writeFile(join(workspace,'build',pass+'.glb'),Buffer.concat(chunks));res.writeHead(201);res.end();return;
  }
  if(req.method==='POST'&&/^\/capture\/texture\/[a-z0-9-]+\.png$/.test(pathname)){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw Error('Texture transport limit');chunks.push(chunk);}
    const directory=join(workspace,'build','textures',captureId);await mkdir(directory,{recursive:true});await writeFile(join(directory,pathname.split('/').pop()),Buffer.concat(chunks));res.writeHead(201);res.end();return;
  }
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(pageHTML);return;}
  if(pathname==='/author.js'){res.setHeader('Content-Type','text/javascript');res.end(app);return;}
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const base=pathname.startsWith('/vendor/')?join(repo,'node_modules/three'):pathname.startsWith('/adapters/')?join(repo,'packages/assets/forge'):workspace;
  const file=resolve(base,pathname.replace(/^\/(vendor|adapters)\//,'').replace(/^\//,''));
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
 await writeFile(join(out,'mesh-buffers.json'),await page.evaluate(()=>JSON.stringify(window.forge.meshBuffers())));
 if(!projectionDiagnostic)execFileSync('python3',[join(repo,'scripts/character-forge/check_upstream_scalp.py'),'--workspace',workspace,'--cache',process.env.CHARACTER_FORGE_UPSTREAM_CACHE||join(repo,'.cache/character-forge-upstream'),'--pass-id',pass],{stdio:'inherit'});
 if(await page.evaluate(()=>window.forge.projected)){
   await page.evaluate(()=>window.forge.stripped());await page.locator('canvas').screenshot({path:join(out,'front-clay.png')});
   const bake=await page.evaluate(()=>window.forge.bake());await writeFile(join(out,'projection-bake.json'),JSON.stringify(bake,null,2));
   await page.evaluate(()=>{window.forge.light('neutral');window.forge.draw('front');});await page.locator('canvas').screenshot({path:join(out,'neutral.png')});
   await page.evaluate(()=>window.forge.closeup());await page.locator('canvas').screenshot({path:join(out,'grazing-closeup.png')});await page.evaluate(()=>window.forge.light('reference'));
 }
 for(const view of ['front','side','back','front34','rear34','oppositeSide']){await page.evaluate(view=>window.forge.draw(view),view);await page.locator('canvas').screenshot({path:join(out,view+'.png')});console.log('FORGE_CAPTURE '+view);}
 if(await page.evaluate(()=>window.forge.projected)){
   const partIds={};for(const view of ['front','side','back']){partIds[view]=await page.evaluate(v=>window.forge.partIds(v),view);await page.locator('canvas').screenshot({path:join(out,view+'-part-ids.png')});}
   await writeFile(join(out,'part-id-palette.json'),JSON.stringify(partIds,null,2));
 }
 const receipt=await page.evaluate(()=>window.forge.snapshot());receipt.errors.push(...errors);receipt.factorySha256=createHash('sha256').update(typescript).digest('hex');receipt.sourceHead=process.env.HEAD_SHA||null;receipt.visualApproval='pending';
 if(projectionDiagnostic)receipt.scope='head-and-chest pixel-bake diagnostic on rejected blockout; upstream pass/state unchanged';
 if(receipt.pass&&!['blockout','structural-pass','form-refinement'].includes(receipt.pass))receipt.referenceLighting=JSON.parse(await readFile(join(workspace,'object-sculpt-spec.json'),'utf8')).referenceReviewLighting;
 await page.evaluate(()=>window.forge.draw('front'));
 await writeFile(join(out,'render-receipt.json'),JSON.stringify(receipt,null,2));
 await writeFile(join(out,'mesh-buffers.json'),await page.evaluate(()=>JSON.stringify(window.forge.meshBuffers())));
 if(!projectionDiagnostic)console.log('FORGE_EXPORT_BYTES '+await page.evaluate(()=>window.forge.exportGLB()));
 if(receipt.errors.length)throw Error(JSON.stringify(receipt.errors));
 console.log(JSON.stringify({pass,parts:receipt.parts.length,triangles:receipt.parts.reduce((n,p)=>n+p.triangles,0),output:out,visualApproval:'pending'}));
}finally{await browser?.close();server.close();}
