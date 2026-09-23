// UNVALIDATED PREPARATION: preserved at user-requested pause; not executed on Scout.
/** Bounded local data transport for actual hosted character browser work. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
export async function withWorkspaceBrowser(workspace,app,operation){
 const w=resolve(workspace),repo=resolve(import.meta.dirname,'../..');
 const html='<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/build/three.module.js","three/addons/":"/vendor/examples/jsm/"}}</script><script type="module" src="/app.js"></script>';
 const server=createServer(async(req,res)=>{try{
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const post=/^\/capture\/(rig|morph)\/([a-z0-9-]+\.(json|glb))$/.exec(path);
   if(req.method==='POST'&&post){const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>256*1024*1024)throw Error('Capture exceeds bounded transport');chunks.push(c);}const directory=join(w,'build',post[1]);await mkdir(directory,{recursive:true});await writeFile(join(directory,post[2]),Buffer.concat(chunks));res.writeHead(201);res.end();return;}
   if(req.method!=='GET')throw Error('Unsupported operation');
   if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
   if(path==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(app);return;}
   if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
   const base=path.startsWith('/vendor/')?join(repo,'node_modules/three'):path.startsWith('/adapters/')?join(repo,'packages/assets/forge'):w;
   const file=resolve(base,path.replace(/^\/(vendor|adapters)\//,'').replace(/^\//,''));if(!file.startsWith(base+'/'))throw Error('Path escape');
   res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png'}[extname(file)]||'application/octet-stream'));res.end(await readFile(file));
 }catch(error){res.writeHead(400);res.end(String(error));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
   const{chromium}=await import('@playwright/test');browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
   const page=await browser.newPage({viewport:{width:540,height:1080}}),errors=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
   await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});await page.waitForFunction(()=>window.ready,null,{timeout:90000});
   const result=await operation(page);if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));return result;
 }finally{await browser?.close();server.close();}
}

/** Original GLB names, extras and frozen geometry survive transport unchanged. */
export const loadReconstructionModule=`
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyReferenceCamera} from '/adapters/reference_camera.js';
import {applyProjectionCentroid} from '/adapters/centroid_uv.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(540,1080);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('white');const camera=new THREE.PerspectiveCamera();
const spec=await(await fetch('/object-sculpt-spec.json')).json(),cameras=await(await fetch('/img2threejs/evidence/cameras.json')).json();
const light=spec.referenceReviewLighting;renderer.toneMapping=light.toneMapping==='none'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=light.exposure;
scene.add(new THREE.HemisphereLight(light.hemisphere.sky,light.hemisphere.ground,light.hemisphere.intensity));
for(const r of [light.key,light.rim]){const lamp=new THREE.DirectionalLight(r.color,r.intensity);lamp.position.fromArray(r.position);lamp.target.position.fromArray(r.target);scene.add(lamp,lamp.target);}
const gltf=await new GLTFLoader().loadAsync('/build/optimization-pass.glb'),root=gltf.scene;
root.traverse(n=>{const a=gltf.parser.associations.get(n);if(a?.nodes!==undefined&&gltf.parser.json.nodes[a.nodes].name)n.name=gltf.parser.json.nodes[a.nodes].name;if(n.isMesh){if(Array.isArray(n.material))throw Error('This frozen transport requires one material per mesh');applyProjectionCentroid(THREE,n.material);n.frustumCulled=false;}});scene.add(root);
function draw(view='front'){applyReferenceCamera(THREE,camera,cameras[view]||cameras.front);root.rotation.y=({front:0,side:-Math.PI/2,back:Math.PI,front34:-Math.PI/4,rear34:-3*Math.PI/4,oppositeSide:Math.PI/2})[view]??0;root.updateMatrixWorld(true);root.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});renderer.render(scene,camera);}
async function captureJson(name,value){const r=await fetch('/capture/rig/'+name+'.json',{method:'POST',body:JSON.stringify(value)});if(!r.ok)throw Error('Frozen payload transport failed');}
`;
