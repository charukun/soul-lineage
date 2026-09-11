import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCharacter, appearanceForCharacter, auditShinoDocument, crowdPlan, PoseSchedule } from '@soul/characters';
import { createMasterCharacterPool, shinoHumanoidFromGLTF } from '@soul/rendering/master-character';
const el = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({canvas: el('stage'), antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#1e3036'); scene.fog = new THREE.Fog('#1e3036', 30, 65);
const camera = new THREE.PerspectiveCamera(38, 1, .1, 120);
scene.add(new THREE.HemisphereLight('#fff6df', '#557481', 2.4));
const sun = new THREE.DirectionalLight('#ffdeb0', 3); sun.position.set(-5, 9, 8); scene.add(sun);
const fill = new THREE.DirectionalLight('#8cd6ec', 2); fill.position.set(8, 5, -8); scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({color:'#2f4549', roughness:1}));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.005; scene.add(ground);
let template = null, pool = null, actors = [], schedules = new Map(), records = [], loading = false, loadAgain = null;
let warmup = 120, frames = [], last = performance.now(), elapsed = 0, failure = null;
const review = { ready: false, errors: [], sample: null, measure: null, pool: null, actors: [], version: THREE.REVISION };
// Review-only diagnostics, never a gameplay or production global.
window.masterCharacterReview = review;
function error(e) { failure = String(e.message || e); review.errors.push(failure); el('status').textContent = `エラー: ${failure}`; el('retry').disabled = !loadAgain; }
window.addEventListener('unhandledrejection', e => error(e.reason));
window.addEventListener('error', e => { review.ready = false; error(e.error || e.message); });
renderer.debug.onShaderError = () => { throw Error('Shader compilation failed; see browser console'); };
function resize() { const c = el('stage'); renderer.setSize(c.clientWidth, c.clientHeight, false); camera.aspect = c.clientWidth / Math.max(1, c.clientHeight); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(el('stage'));
function resetMeasure() { warmup = 120; frames = []; }
function rebuild() {
  if (!pool) return;
  actors.forEach(a => pool.despawn(a.id)); actors = []; schedules = new Map(); records = [];
  const count = Number(el('count').value), age = Number(el('age').value), mixed = el('ages').value === 'mixed';
  for (let i = 0; i < count; i++) {
    const outfit = el('outfit').value === 'mixed' ? ['original','moss','ember'][i % 3] : el('outfit').value;
    const record = createCharacter({id:`review.${i}`, seed:1000 + i, ageMs:(mixed ? [0,7,22,55,85][i%5] : age) * 60000, outfitId:`shino.uniform.${outfit}.v1`});
    // Include endpoints in the visual regression grid.
    if (count === 30 && i < 2) for (const gene of ['height','build']) record.genome[gene] = [i * 65535, i * 65535];
    const a = pool.spawn(record.id); scene.add(a.root, a.attachments);
    a.root.position.set(count === 1 ? 0 : (i%6-2.5)*2.25, 0, count === 1 ? 0 : (Math.floor(i/6)-2)*2.5);
    a.sample(appearanceForCharacter(record)); actors.push(a); records.push(record); schedules.set(a.id, new PoseSchedule());
  }
  camera.position.set(count === 1 ? 2.8 : 13, count === 1 ? 1.6 : 11, count === 1 ? 4.5 : 20);
  camera.lookAt(0, count === 1 ? 1 : .7, 0); resetMeasure(); review.actors = actors; review.records = records;
}
function disposeTemplate() {
  if (!template) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  template.traverse(n => { if (!n.isMesh) return; geometries.add(n.geometry); (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {materials.add(m);Object.values(m).forEach(v => {if(v?.isTexture) textures.add(v);});}); });
  geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose()); template = null;
}
async function load(getBytes) {
  if (loading) return;
  loading = true; failure = null; review.ready = false; loadAgain = getBytes; el('retry').disabled = true;
  el('status').textContent = 'モデル取得・ハッシュと利用条件を確認中…'; el('progress').value = .1;
  try {
    const bytes = await getBytes();
    if (bytes.byteLength > 128*1024*1024 || bytes.byteLength < 20) throw Error('モデルサイズが不正です');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const view = new DataView(bytes);
    if (view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==bytes.byteLength || view.getUint32(16,true)!==0x4e4f534a) throw Error('GLB形式が不正です');
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))));
    const audit = auditShinoDocument(json,hash); if (!audit.approved) throw Error(`モデル監査不合格: ${audit.errors.join(', ')}`);
    el('status').textContent = 'モデル読込・GPU準備中…'; el('progress').value = .4;
    const gltf = await new GLTFLoader().parseAsync(bytes,'');
    const humanoid = await shinoHumanoidFromGLTF(gltf);
    const nextPool = createMasterCharacterPool({template:gltf.scene,humanoid});
    pool?.dispose(); disposeTemplate(); pool = nextPool; template = gltf.scene; review.pool = pool; review.audit = audit;
    rebuild(); el('progress').value = .8; renderer.compile(scene,camera); renderer.render(scene,camera);
    if (failure) throw Error(failure);
    review.ready = true; el('progress').value = 1; el('status').textContent = '監査済みモデルを表示中。30体の個体差・加齢・共有状態を確認できます。';
  } catch(e) { error(e); } finally { loading = false; el('retry').disabled = false; }
}
el('file').addEventListener('change', () => { const file = el('file').files[0]; if (file) { if(file.size>128*1024*1024)error(Error('ファイルが大きすぎます')); else load(()=>file.arrayBuffer()); } });
el('retry').addEventListener('click',()=>{if(loadAgain)load(loadAgain);});
for (const id of ['count','age','ages','outfit']) el(id).addEventListener('change',()=>{el('age-label').value=`${el('age').value}歳`;rebuild();});
el('measure').onclick=resetMeasure;
const axis = new THREE.Vector3(0,0,1), pitch = new THREE.Vector3(1,0,0), q = new THREE.Quaternion();
function pose(b,t) {
  // Explicit review pose. Real gameplay clips are supplied by the existing animation system.
  b.leftUpperArm.quaternion.multiply(q.setFromAxisAngle(axis,-1.25)); b.rightUpperArm.quaternion.multiply(q.setFromAxisAngle(axis,1.25));
  b.leftLowerArm.quaternion.multiply(q.setFromAxisAngle(pitch,-.15)); b.rightLowerArm.quaternion.multiply(q.setFromAxisAngle(pitch,-.15));
  b.spine.quaternion.multiply(q.setFromAxisAngle(axis,Math.sin(t*1.4)*.016));
}
function measure() {
  const sorted = [...frames].sort((a,b)=>a-b), p = q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))] ?? null;
  return {three:THREE.REVISION, sampleCount:frames.length, medianMs:p(.5), p95Ms:p(.95), info:{calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}, pool:pool?.stats(), hardwareAcceptance:'not-measured'};
}
review.measure = measure; review.sample = (age)=>{el('ages').value='fixed';el('age').value=age;rebuild();};
function frame(now) {
  requestAnimationFrame(frame); const actualDelta=(now-last)/1000, delta=Math.min(1,actualDelta);last=now;elapsed+=delta;
  if (!review.ready) {renderer.render(scene,camera);return;}
  const plan=new Map(crowdPlan(actors.map((a,i)=>({id:a.id,visible:true,important:i===0,distance:a.root.position.distanceTo(camera.position)}))).map(p=>[p.id,p]));
  actors.forEach((a,i)=>{const p=plan.get(a.id);if(schedules.get(a.id).advance(delta,p.animationHz)!==null)a.sample(appearanceForCharacter(records[i]),elapsed+i*.19,el('motion').checked?pose:null);if(el('rotate').checked)a.root.rotation.y=elapsed*.22;});
  renderer.render(scene,camera);if(warmup>0)warmup--;else{frames.push(actualDelta*1000);if(frames.length>900)frames.shift();}
  if(frames.length%15===0){const m=measure();el('metrics').textContent=`Three r${m.three}\n${m.pool.active}体 / 共有Geometry ${m.pool.geometries}\n共有Texture ${m.pool.textures}\nDraw calls ${m.info.calls}\nTriangles ${m.info.triangles.toLocaleString()}\nフレーム ${m.medianMs?.toFixed(1)??'—'} ms (中央値)\np95 ${m.p95Ms?.toFixed(1)??'—'} ms\n測定 ${m.sampleCount}フレーム`;}
}
requestAnimationFrame(frame);
const asset = './simulator/assets/SHINO_review.vrm';
if (asset) {
  const url = new URL(asset,location.href);
  if(url.origin!==location.origin)error(Error('レビュー用assetは同一originのみ利用できます'));
  else load(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const size=Number(r.headers.get('content-length'));if(size>128*1024*1024)throw Error('モデルサイズ超過');return r.arrayBuffer();});
}
