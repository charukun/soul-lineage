"""Task-only source materialization. Writes blobs, NEVER refs, commits or deployments."""
from pathlib import Path
import json, shutil, os, subprocess, urllib.request, tarfile
BASE='67d33c8f1fd181cb6b82724bb2b8a58e0a757a96'
REPO='charukun/soul-lineage'
assert os.environ['GITHUB_REPOSITORY']==REPO
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==BASE
new_files=['apps/review/review-camera.html','apps/review/src/review-camera.css','apps/review/src/review-camera.js','apps/review/tests/camera-review.test.mjs','apps/rinne/src/rebuild/presentation-camera.js','docs/rendering/CAMERA_PRESENTATION.md','packages/rendering/src/camera-director.js','packages/rendering/src/camera-presentation-three.js','packages/rendering/src/camera/math.js','packages/rendering/src/character-view-resolver.js','packages/rendering/src/foreground-instance-proxies.js','packages/rendering/tests/camera-director.test.mjs','packages/rendering/tests/camera-presentation-three.test.mjs']
for name in new_files:
 p=Path(name);assert not p.exists(),name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(Path('../control')/name,p)
modified=[]
def edit(name,fn):
 p=Path(name);s=p.read_text();v=fn(s);assert v!=s,name;p.write_text(v);modified.append(name)
def replace(s,a,b):
 assert a in s,a[:120]
 return s.replace(a,b)
def json_edit(name,fn):
 p=Path(name);v=json.loads(p.read_text());fn(v);p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n');modified.append(name)
json_edit('packages/rendering/package.json',lambda v:v['exports'].update({f'./{n}':f'./src/{n}.js' for n in ['camera-director','character-view-resolver','camera-presentation-three']}))
json_edit('apps/review/package.json',lambda v:v['dependencies'].update({'@soul/rendering':'*'}))
json_edit('package-lock.json',lambda v:v['packages']['apps/review']['dependencies'].update({'@soul/rendering':'*'}))
edit('apps/review/src/review-lab-config.js',lambda s:replace(s,"  hybrid25d:new URL(","  camera:new URL('./review-camera',location.href).href,\n  hybrid25d:new URL("))
edit('apps/review/vite.config.js',lambda s:replace(s,"  hybrid25d:fileURLToPath(","  camera:fileURLToPath(new URL('./review-camera.html',import.meta.url)),\n  hybrid25d:fileURLToPath("))
edit('apps/review/index.html',lambda s:replace(s,'<a data-route="hybrid25d">','<a data-route="camera"><b>Camera Presentation Review</b><span>構図 / 遷移 / 3D・2.5D共通視点</span></a><a data-route="hybrid25d">'))
def renderer(s):
 s=replace(s,"import { rinneCombatCameraFrame } from './combat-camera.js';","import { rinneCombatCameraFrame } from './combat-camera.js';\nimport { createRinnePresentationCamera } from './presentation-camera.js';")
 s=replace(s,'cameraLook=new THREE.Vector3(),','')
 s=replace(s,",firstPersonForward=new THREE.Vector3();let elapsed=0,cameraLookReady=false,lastSpace='',interiorYaw=0;",';let elapsed=0;\n  const presentationCamera=createRinnePresentationCamera({camera,scene,canvas});')
 s=replace(s,';if(Math.abs(camera.fov-nextFov)>.01){camera.fov=nextFov;camera.updateProjectionMatrix();}',';')
 s=replace(s,"return normalized>=1?'title-living-still':'title-cinematic';","return {position:{x:desired.x,y:desired.y,z:desired.z},lookTarget:{x:target.x,y:target.y,z:target.z},fov:nextFov,label:normalized>=1?'title-living-still':'title-cinematic'};")
 s=replace(s,',spaceChanged=space!==lastSpace;lastSpace=space;',';')
 start=s.index('    if(titleFrame){',s.index('function renderState'))
 end=s.index('    if(village&&!inside){terrain.waterMat',start)
 s=s[:start]+'''    const titleShot=titleFrame?applyTitlePreviewCamera(state,titleTime,titleIdleTime):null;
    const targetEnemy=combatFrame?(currentFront?.enemies||[]).find(enemy=>!enemy.dead&&enemy.id===state.combat?.targetId)||(currentFront?.enemies||[]).filter(enemy=>!enemy.dead).sort((a,b)=>Math.hypot(a.x-state.position.x,a.z-state.position.z)-Math.hypot(b.x-state.position.x,b.z-state.position.z))[0]:null;
    const cameraFrame=presentationCamera.update({state,dt,inside,titleFrame,titleShot,combatFrame,offset:camOffset,targetEnemy});
    const presentation=cameraFrame.presentation;target.set(presentation.lookTarget.x,presentation.lookTarget.y,presentation.lookTarget.z);
    canvas.dataset.cameraMode=titleFrame?titleShot.label:inside?'interior-first-person':combatFrame?'combat-third-person':'third-person';
    const occlusion=foregroundOcclusion.update({camera,target,targets:cameraFrame.samples,occluderRoots:inside?[interiorGroups.get(state.interior.buildingId)]:[objects,stationsRoot],instanceOccluders:inside?[]:terrain.forestMeshes,enabled:village&&!titleFrame,dt});
    presentationCamera.recordOcclusion(occlusion.occludedRatio||0);canvas.dataset.occludedObjects=String(occlusion.occluded);
'''+s[end:]
 s=replace(s,'focusPoint.set(state.position.x,1.15,state.position.z)','focusPoint.set(state.position.x,cameraFrame.actor.focusHeight,state.position.z)')
 s=replace(s,'observer.disconnect();cameraControl.dispose();','observer.disconnect();presentationCamera.dispose();cameraControl.dispose();')
 s=replace(s,'return{THREE,scene,camera,viewport,renderState,','return{THREE,scene,camera,viewport,presentationCamera,renderState,')
 return s
edit('apps/rinne/src/rebuild/renderer.js',renderer)
def fader(s):
 s=replace(s,"import { Raycaster, Vector3 } from 'three';","import { Raycaster, Vector3 } from 'three';\nimport { createForegroundInstanceProxies } from './foreground-instance-proxies.js';")
 s=replace(s,'matrixState.root !== occluderRoot','!matrixState.roots.has(occluderRoot)');s=replace(s,'matrixState.root = occluderRoot;','matrixState.roots.add(occluderRoot);')
 s=replace(s,'if (!hit?.object || hit.object.visible === false) continue;','if (!hit?.object || hit.object.visible === false || hit.object.isInstancedMesh || hit.object.userData?.occlusionFadeDisabled) continue;')
 s=replace(s,'const entries = new Map(), matrixState = { root: null };','const entries = new Map(), matrixState = { roots: new WeakSet() }, instances = createForegroundInstanceProxies();')
 s=replace(s,'let activeRoots = new Set(), sampleClock = 0, sampled = false;','let activeRoots = new Set(), sampleClock = 0, sampled = false, occludedRatio = 0;')
 start=s.index('  const snapshot = (transitioning = 0)')
 return s[:start]+Path('../control/scripts/camera-fader-tail.txt').read_text()
edit('packages/rendering/src/foreground-occlusion.js',fader)
p=Path('packages/rendering/src/character-view-resolver.js');p.write_text(p.read_text().replace('Zero horizontal separation, action locks and dt=0 preserve stable ownership.','Zero horizontal separation and action locks preserve stable ownership.'))
p=Path('packages/rendering/src/camera-director.js');s=p.read_text();start=s.index('function frameOrbit(');end=s.index('function lensScale(',start);p.write_text(s[:start]+s[end:])
p=Path('apps/review/src/review-camera.js');p.write_text(p.read_text().replace("String(viewYaw(view) * 180 / Math.PI + Number($('actor-yaw').value))","String(((viewYaw(view) * 180 / Math.PI + Number($('actor-yaw').value) + 540) % 360) - 180)"))
files=modified+new_files
subprocess.run(['git','diff','--check'],check=True)
Path('/tmp/camera-materialized').mkdir(exist_ok=True)
manifest={'base':BASE,'files':[]}
for name in files:
 data=json.dumps({'content':Path(name).read_text(),'encoding':'utf-8'}).encode()
 req=urllib.request.Request(f'https://api.github.com/repos/{REPO}/git/blobs',data=data,method='POST',headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:blob=json.load(r)
 manifest['files'].append({'path':name,'mode':'100644','type':'blob','sha':blob['sha']})
Path('/tmp/camera-materialized/manifest.json').write_text(json.dumps(manifest,indent=2))
with tarfile.open('/tmp/camera-materialized/source.tgz','w:gz') as tar:
 for name in files:tar.add(name,arcname=name)
print('CAMERA_BLOBS '+json.dumps(manifest))
