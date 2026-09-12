from pathlib import Path
import hashlib
r=Path.cwd()
def blob(p):
 b=(r/p).read_bytes();return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
assert blob('apps/rinne/src/review/main.js')=='dac0d2790d844c5f91cb40bca62e210eed27b7e0'
assert blob('apps/rinne/src/review/review-state.js')=='f48c118f04f4c7041d1ffe3a72217ec64ffc63d0'
p=r/'apps/rinne/src/review/review-state.js';s=p.read_text().replace("clip:p.get('clip')||'通常 / 自然体'","clip:p.get('rest')==='1'?'':p.has('clip')?p.get('clip'):'通常 / 自然体'");p.write_text(s)
p=r/'apps/rinne/src/review/main.js';s=p.read_text().replace("const names=state.sequence?.length?[...state.sequence]:[state.clip||'通常 / 自然体'];","const names=state.sequence?.length?[...state.sequence]:state.clip?[state.clip]:[];")
s=s.replace("const savedTime=state.time,savedClip=state.clip,playing=state.playing;","const savedTime=state.time,playing=state.playing;")
s=s.replace("    if(!restoreSelection()){clock.playing=false;setStatus('指定モーションを読み込み中');}","    if(!body.poseTransfer&&!state.shared&&!body.clipNames.includes(state.clip)){state.clip=body.clipNames[0]||'';state.sequence=[];}\n    if(!restoreSelection()){clock.playing=false;setStatus('指定モーションを読み込み中');}")
s=s.replace("state.weaponScale=numeric('#weapon-scale',.5);state.weaponX=numeric('#weapon-x');state.weaponY=numeric('#weapon-y');state.weaponZ=numeric('#weapon-z');","state.weaponScale=Math.max(.1,Math.min(1,numeric('#weapon-scale',.5)));state.weaponX=Math.max(-360,Math.min(360,numeric('#weapon-x')));state.weaponY=Math.max(-360,Math.min(360,numeric('#weapon-y')));state.weaponZ=Math.max(-360,Math.min(360,numeric('#weapon-z')));")
p.write_text(s)
p=r/'apps/rinne/tests/review-plan/state.test.mjs';p.write_text(p.read_text()+'''

test('rest pose URLs preserve an explicitly empty clip and legacy rest flag',()=>{
 const s={...readReviewState(''),clip:'',sequence:[],playing:false};
 const round=readReviewState(reviewStateURL('https://example.invalid/',s).searchParams);
 assert.equal(round.clip,'');assert.equal(round.playing,false);assert.equal(readReviewState('rest=1').clip,'');
});
''')
for p,h in [('apps/rinne/src/review/main.js','7726ab6f557fd2f7a51760ac22ad18f7a336fdec'),('apps/rinne/src/review/review-state.js','26ebfa9624641d1eb5bc27b82fbe8d0640ff7c11')]:assert blob(p)==h,(p,blob(p),h)
p=r/'tests/review-plan-browser.mjs';s=p.read_text();marker=" await step('No runtime/page errors or failed requests; converted motion integrity is enforced'";assert s.count(marker)==1
s=s.replace(marker,''' await step('Static rig inspection also round-trips through the public state URL',async()=>{
  await page.locator('[data-primary="advanced"]').click();await page.locator('#rest-pose').click();
  const before=await snap();assert.equal(before.state.clip,'');assert.equal(before.state.playing,false);
  const link=await page.evaluate(()=>window.__reviewLab.stateURL());const other=await context.newPage();observe(other);
  await other.goto(link,{waitUntil:'domcontentloaded',timeout:60000});await ready(other);await other.waitForTimeout(300);
  const after=await snap(other);assert.equal(after.state.clip,'');assert.equal(after.state.playing,false);assert.deepEqual(after.sequence,[]);
  await other.screenshot({path:resolve(out,'static-restored.png')});await other.close();return{before:before.state,after:after.state};
 });
'''+marker);p.write_text(s)
print('Static pose and manual-source compatibility retained; UI offsets use the same bounds as restored URLs')
