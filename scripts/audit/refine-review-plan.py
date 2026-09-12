# Correct findings from actual textured browser evidence, without weakening gates.
from pathlib import Path
import hashlib
r=Path.cwd()
def replace(path,old,new):
 p=r/path;s=p.read_text();assert s.count(old)==1,(path,s.count(old),old[:80]);p.write_text(s.replace(old,new))
pose='apps/rinne/src/review/pose-transfer.js'
p=r/pose;s=p.read_text();assert 'export function sampleRawClip' not in s
p.write_text(s+'''
/** Explicit writes are required after resetPose: AnimationMixer intentionally
 * caches unchanged values, so update(0) alone can leave a paused model in rest.
 */
const samplers=new WeakMap();
export function sampleRawClip(clip,root,time){
 let roots=samplers.get(clip);if(!roots){roots=new WeakMap();samplers.set(clip,roots);}
 let bindings=roots.get(root);
 if(!bindings){bindings=clip.tracks.map(track=>{
  const dot=track.name.lastIndexOf('.'),id=track.name.slice(0,dot),property=track.name.slice(dot+1);
  const node=root.getObjectByProperty('uuid',id)||root.getObjectByName(id);
  if(!node||!['quaternion','position','scale'].includes(property))throw new Error(`Unresolved review pose channel: ${track.name}`);
  return{node,property,interpolant:track.createInterpolant()};
 });roots.set(root,bindings);}
 for(const{node,property,interpolant}of bindings){node[property].fromArray(interpolant.evaluate(Math.max(0,Math.min(clip.duration,time))));if(property==='quaternion')node.quaternion.normalize();}
 root.updateMatrixWorld(true);
}
''')
main='apps/rinne/src/review/main.js'
replace(main,"import './review-controls.css';","import './review-controls.css';\nimport { sampleRawClip } from './pose-transfer.js';")
replace(main,"action.time=clock.time;mixer.update(0);","action.time=clock.time;mixer.update(0);if(body.resetPose)sampleRawClip(activeClip,body.root,clock.time);")
replace(main,"const box=new THREE.Box3().setFromObject(body.root);","const box=new THREE.Box3();body.root.traverseVisible(node=>{if(node.isMesh)box.union(new THREE.Box3().setFromObject(node));});")
replace(main,"poseTransfer:body?.poseTransfer||null,","poseTransfer:body?.poseTransfer||null,worldPose:body?.bones?Object.fromEntries(['rightHand','leftHand','rightLowerArm','rightUpperArm','leftFoot','rightFoot'].map(n=>[n,body.bones[n].getWorldPosition(new THREE.Vector3()).toArray()])):null,")
replace('apps/rinne/src/review/weapon-review-polish.js',"-.28*unit);q=bladeQ(active==='crossbow'","-(active==='crossbow'?.17:active==='staff'?.19:.28)*unit);q=bladeQ(active==='crossbow'")
replace('apps/rinne/src/review/review-controls.js',"  if(selected!==state.clip){selected=state.clip;","  if(selected!==state.clip){selected=state.clip;q('#motion-name').textContent=selected==='Tidebreak / Attack'?'右の直突き':selected||'元モデル';q('#motion-meta').textContent=selected;")
replace('apps/rinne/src/review/review-controls.css',".motion-browser>input{min-height:38px;font-size:12px;position:relative}",".motion-browser>input{display:block;width:100%;min-height:38px;font-size:12px;position:sticky;top:0;z-index:2;background:#11292c;color:#ede3c8;border:1px solid var(--line);border-radius:5px;padding:7px 10px}")
pt='apps/rinne/tests/review-plan/pose.test.mjs'
replace(pt,'{rawClipFromNormalized}','{rawClipFromNormalized,sampleRawClip}')
p=r/pt;p.write_text(p.read_text()+'''
test('paused and reverse seeks explicitly reapply the raw pose after reset',()=>{
 sampleRawClip(output,vrm.scene,.56);const expected=point('rightHand').clone();
 for(const time of [0,.56,1.45,.56]){for(const b of Object.values(raw))b.quaternion.identity();sampleRawClip(output,vrm.scene,time);if(time===.56)assert.ok(point('rightHand').distanceTo(expected)<1e-6);}
});
''')
t='tests/review-plan-browser.mjs'
replace(t,"frames.push({time:f.time,pose:f.pose});","frames.push({time:f.time,pose:f.pose,worldPose:f.worldPose});")
replace(t,"  await page.locator('[data-camera=\"right\"]').click();for","  assert.ok(frames[2].worldPose.rightHand[2]-frames[0].worldPose.rightHand[2]>.15,'paused display must show the punch, not T-pose');\n  await page.locator('[data-camera=\"right\"]').click();for")
replace(t,"await shot('weapon-'+id);const s","await shot('weapon-'+id);for(const angle of ['front','right']){await page.locator(`[data-camera=\"${angle}\"]`).click();await shot('weapon-'+id+'-'+angle);}const s")
replace(t,"if(s.weapon.support)assert.ok(s.weapon.supportError<.035,JSON.stringify(s.weapon));}","if(s.weapon.support)assert.ok(s.weapon.supportError<.035,JSON.stringify(s.weapon));await page.locator('[data-combat-mode=\"normal\"]').click();await shot('weapon-'+id+'-normal');assert.equal((await snap()).state.mode,'normal');await page.locator('[data-combat-mode=\"combat\"]').click();}")
replace(t,"await motion('技 / 流し斬り');await waitWeapon('katana')","await page.locator('#weapon-toggle').uncheck();await motion('技 / 流し斬り');await waitWeapon('katana')")
for path,expected in [(main,'c83be5d5d37da23955b32b6f08f6510eefa40ab9'),(pose,'f32785963958ba3ba69d7063f970ccd19c0f72d7')]:
 b=(r/path).read_bytes();actual=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert actual==expected,(path,actual,expected)
print('Paused renderer, support reach and stronger visual assertions corrected')
