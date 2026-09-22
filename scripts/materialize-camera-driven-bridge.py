from pathlib import Path
import os,json,subprocess,shutil,urllib.request,tarfile
BASE='d62bc23e13d2ad2d2f67011235582cb8d34f1271';REPO='charukun/soul-lineage'
assert os.environ['GITHUB_REPOSITORY']==REPO
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==BASE
files=[]
def change(name,a,b):
 p=Path(name);s=p.read_text();assert a in s,(name,a[:100]);p.write_text(s.replace(a,b))
 if name not in files:files.append(name)
for name in ['packages/rendering/src/camera-external-frame.js','packages/rendering/tests/camera-external-frame.test.mjs']:
 shutil.copyfile(Path('../control')/name,name);files.append(name)
change('packages/rendering/src/camera-director.js',"export { normalizeAngle, angleDelta }", "export { externalCameraShot } from './camera-external-frame.js';\nexport { normalizeAngle, angleDelta }")
name='apps/rinne/src/rebuild/presentation-camera.js'
change(name,'{ createCameraDirector }','{ createCameraDirector, CAMERA_PROFILES, cameraSubject, externalCameraShot }')
change(name,"  let yawOffset = 0,", "  let profileName = 'current3d';\n  let yawOffset = 0,")
change(name,"    setProfile: name => director.setProfile(name),", "    setProfile(name) { director.setProfile(name); profileName = name; },\n"+'''    // Alternate 3D renderers supply subjects and an authored frame, not their
    // own director. Shared transition/view ownership survives renderer handoff.
    presentExternal({ camera: activeCamera, actor: actorInput, target: targetInput, position, lookTarget, worldHeight, dt = 0, source = 'external3d', space = 'frontier', mode = 'combat' }) {
      const actor = cameraSubject(actorInput), target = targetInput ? cameraSubject(targetInput) : null;
      const authoredShot = externalCameraShot({ position, lookTarget, worldHeight, fov: CAMERA_PROFILES[profileName].fov, yawOffset });
      const presentation = director.update({ mode, actor, target, authoredShot, aspect: activeCamera.aspect, space, screenSafety }, dt);
      applyCameraPresentation(activeCamera, presentation);
      playerView = resolveCharacterView({ cameraPosition: activeCamera.position, actorPosition: actor.position, actorYaw: actor.yaw, state: playerView, dt });
      screenSafety = actorScreenSafety(activeCamera, target ? [actor, target] : [actor]);
      snapshot = { camera: { ...presentation, screenSafety }, playerView, actor, target, actorRuntime: '3d', actorYaw: actor.yaw, yawOffset, renderer: source };
      return presentation;
    },''')
name='apps/rinne/src/rebuild/johakyu-world-renderer.js'
change(name,"notify:()=>{},signal:own.signal});", "notify:()=>{},signal:own.signal,cameraPresentation:view.presentationCamera});")
name='packages/johakyu-presentation/src/runtime.js'
change(name,'rules=null,presentationPort=null})','rules=null,presentationPort=null,cameraPresentation=null})')
change(name,'const size=W/H<.8?31:23;camera.left=-size*W/H/2;camera.right=size*W/H/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();', "const size=W/H<.8?31:23;if(camera.isPerspectiveCamera)camera.aspect=W/H;else{camera.left=-size*W/H/2;camera.right=size*W/H/2;camera.top=size/2;camera.bottom=-size/2;}camera.updateProjectionMatrix();")
change(name,'camera=new THREE.OrthographicCamera(-20,20,12,-12,.1,160);','camera=presentationPort&&cameraPresentation?new THREE.PerspectiveCamera(40,W/H,.1,160):new THREE.OrthographicCamera(-20,20,12,-12,.1,160);')
change(name,"const scale=H/(camera.top-camera.bottom);", "const scale=camera.isPerspectiveCamera?H/Math.max(.01,2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.distanceTo(cameraTarget)):H/(camera.top-camera.bottom);")
start=' const desired=isTitle?new V(-2,.6,0):midpoint.add(new V(0,.65,-.35));cameraTarget.lerp(desired,1-Math.exp(-dt*3.8));'
end=' camera.lookAt(cameraTarget);camera.updateMatrixWorld();heroLight.position.copy(hero.pos).add(new V(0,3.5,0));for(const t of torches)t.light.intensity=30+Math.sin(clock*7+t.seed)*5;'
s=Path(name).read_text();a=s.index(start);b=s.index(end,a)
old=s[a:b]
new=''' const desired=isTitle?new V(-2,.6,0):midpoint.add(new V(0,.65,-.35));
 const desiredZoom=isTitle?1:clamp((W/H<.8?1.02:1.08)-Math.max(0,spread-1.8)*.055+game.cameraPunch,.82,1.12);
 const baseAngle=isTitle?.62+Math.sin(intro*.045)*.08:.65,approach=isTitle?1+Math.max(0,1-intro/7)*.32:1;
 if(presentationPort&&cameraPresentation){
  const subject=a=>a?{id:a.canonicalId||a.object.uuid,position:{x:a.pos.x,y:a.pos.y,z:a.pos.z},yaw:a.object.rotation.y,height:a.height,focusHeight:a.height*.58,radius:a.height*.3,weaponRadius:a.height*.65}:null;
  const authoredPosition={x:desired.x+Math.sin(baseAngle)*23*approach+game.cameraImpulseX,y:desired.y+22*approach,z:desired.z+Math.cos(baseAngle)*23*approach+game.cameraImpulseZ};
  if(game.shake>0){authoredPosition.x+=Math.sin(clock*93)*game.shake;authoredPosition.y+=Math.cos(clock*84)*game.shake*.5;}
  const shot=cameraPresentation.presentExternal({camera,actor:subject(hero),target:subject(opponent),position:authoredPosition,lookTarget:desired,worldHeight:(W/H<.8?31:23)*approach/desiredZoom,dt,source:'johakyu-driven',space:'frontier',mode:'combat'});
  cameraTarget.set(shot.lookTarget.x,shot.lookTarget.y,shot.lookTarget.z);
 }else{
  // Standalone/native review keeps its accepted legacy lens and composition.
  cameraTarget.lerp(desired,1-Math.exp(-dt*3.8));
  camera.zoom=lerp(camera.zoom,desiredZoom,1-Math.exp(-dt*7));camera.updateProjectionMatrix();
  camera.position.set(cameraTarget.x+Math.sin(baseAngle)*23*approach+game.cameraImpulseX,cameraTarget.y+22*approach,cameraTarget.z+Math.cos(baseAngle)*23*approach+game.cameraImpulseZ);
  if(game.shake>0){camera.position.x+=Math.sin(clock*93)*game.shake;camera.position.y+=Math.cos(clock*84)*game.shake*.5;}
 }
 game.cameraImpulseX*=Math.exp(-dt*13);game.cameraImpulseZ*=Math.exp(-dt*13);game.cameraPunch=Math.max(0,game.cameraPunch-dt*.34);
'''
change(name,old,new)
change(name,"authority:'rinne-domain'}),snapshot", "authority:'rinne-domain',cameraProjection:camera?.isPerspectiveCamera?'perspective':'orthographic',sharedCamera:Boolean(cameraPresentation)}),snapshot")
name='docs/rendering/CAMERA_PRESENTATION.md'
p=Path(name);p.write_text(p.read_text()+'''\n## Alternate equipped-3D battle renderer\n\nThe accepted heavy-armor/sword `johakyu` path previously bypassed RINNE's renderer camera entirely. RINNE now passes the same `presentationCamera` into `createDrivenBattleRuntime`; its `presentExternal` port applies the shared Director and View Resolver to that renderer's PerspectiveCamera. Renderer handoff does not reset transition or view ownership. Authored pair framing, camera impulses, actual 3D models/equipment/animations and canonical combat authority remain; orthographic focal-plane coverage is converted to equivalent perspective distance. Effect pixel scale follows perspective depth. Standalone/native Review demonstrations which do not provide the RINNE camera port retain their existing lens; the game-driven path does not depend on them. No additional rendering-package dependency is added to the standalone runtime: this is an injected port.\n''');files.append(name)
subprocess.run(['git','diff','--check'],check=True)
out=Path('/tmp/camera-driven-bridge');out.mkdir(exist_ok=True);manifest={'base':BASE,'files':[]}
for name in files:
 req=urllib.request.Request(f'https://api.github.com/repos/{REPO}/git/blobs',data=json.dumps({'content':Path(name).read_text(),'encoding':'utf-8'}).encode(),method='POST',headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:blob=json.load(r)
 manifest['files'].append({'path':name,'mode':'100644','type':'blob','sha':blob['sha']})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
with tarfile.open(out/'source.tgz','w:gz') as tar:
 for name in files:tar.add(name,arcname=name)
print('CAMERA_DRIVEN_BRIDGE '+json.dumps(manifest))
