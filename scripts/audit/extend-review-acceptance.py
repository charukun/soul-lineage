from pathlib import Path
r=Path.cwd()
p=r/'apps/rinne/tests/review-plan/pose.test.mjs';p.write_text(p.read_text()+'''

test('both thumbs oppose the curled fingers rather than remaining spread out',()=>{
 sampleRawClip(output,vrm.scene,.56);
 for(const side of ['left','right']){
  const thumb=point(side+'ThumbDistal'),index=point(side+'IndexIntermediate');
  assert.ok(thumb.distanceTo(index)<.025,side+' thumb must be near the curled index finger');
 }
});
''')
p=r/'apps/rinne/tests/review-plan/state.test.mjs';p.write_text(p.read_text()+'''

test('sequence URL preserves repeated stages and final paused global time',()=>{
 const s={...readReviewState(''),sequence:['Tidebreak / Idle','Tidebreak / Attack','Tidebreak / Attack'],clip:'Tidebreak / Attack',time:6.9,playing:false,loop:false};
 const r=readReviewState(reviewStateURL('https://example.invalid/',s).searchParams);
 assert.deepEqual(r.sequence,s.sequence);assert.equal(r.time,s.time);assert.equal(r.playing,false);assert.equal(r.loop,false);
});
''')
p=r/'tests/review-plan-browser.mjs';s=p.read_text()
needle=" await step('No runtime/page errors or failed requests; converted motion integrity is enforced'"
assert s.count(needle)==1;i=s.index(needle)
new=''' await step('Concurrent native draw/sheathe, staged playback and editable feedback remain functional',async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.locator('.model-select-trigger').click();await page.locator('.model-picker-item').filter({has:page.locator('small',{hasText:/^SHINO$/})}).click();
  await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded&&window.__reviewLab.snapshot().state.preset==='model.SHINO',null,{timeout:120000});
  await page.waitForFunction(()=>window.__reviewLab.snapshot().animations.includes('姿勢 / 納刀（ゲーム共通）'),null,{timeout:150000});
  const transitions=[];
  for(const[kind,name]of [['draw','姿勢 / 抜刀（ゲーム共通）'],['sheathe','姿勢 / 納刀（ゲーム共通）']]){
   await motion(name);await waitWeapon('sword');
   for(const t of [0,.425,.70,1.40]){await page.evaluate(time=>window.__reviewLab.seek(time),t);await page.waitForTimeout(100);const f=await snap();assert.equal(f.posture.kind,kind);transitions.push(f.posture);await shot('posture-'+kind+'-'+String(t).replace('.','_'));}
  }
  assert.equal(transitions[0].attachment,'hips');assert.equal(transitions[3].attachment,'hand');assert.equal(transitions[4].attachment,'hand');assert.equal(transitions[7].attachment,'hips');
  await page.locator('[data-primary="advanced"]').click();await page.locator('.legacy-review > summary').click();
  const skill=page.locator('.legacy-review > details').filter({has:page.locator('[data-review-page="skill"]')});await skill.locator(':scope > summary').click();
  const names=['Tidebreak / Idle','Tidebreak / Attack','技 / 流し斬り'];
  for(const[id,name]of ['stage-jo','stage-ha','stage-kyu'].map((id,i)=>[id,names[i]])){
   await page.locator(`[data-picker-for="${id}"]`).click();const choices=page.locator('#picker-list .picker-item');const index=await choices.evaluateAll((ns,v)=>ns.findIndex(n=>n.querySelector('small')?.textContent===v),name);assert.ok(index>=0);await choices.nth(index).click();
  }
  await page.locator('[data-play-select="stage-kyu"]').click();let f=await snap();assert.deepEqual(f.sequence,names);assert.ok(Math.abs(f.duration-6.73)<.01);assert.equal(f.state.loop,false);
  await page.evaluate(()=>window.__reviewLab.seek(4.56));f=await snap();assert.equal(f.sequenceIndex,1);assert.equal(f.state.clip,names[1]);assert.equal(f.state.weaponEnabled,false);
  await page.evaluate(()=>window.__reviewLab.seek(6.73));f=await snap();assert.equal(f.sequenceIndex,2);assert.equal(f.state.clip,names[2]);await shot('sequence-final');
  const link=await page.evaluate(()=>window.__reviewLab.stateURL());assert.deepEqual(new URL(link).searchParams.getAll('stage'),names);
  // Feedback is a dialog with editable text and an explicit copy gesture, not automatic approval.
  await page.locator('#copy-motion').click();await page.locator('#review-feedback-dialog').waitFor({state:'visible'});
  const original=await page.locator('#review-feedback-text').inputValue();assert.ok(original.includes('6.730s'));assert.ok(original.includes(names.join(' → ')));
  await page.locator('#review-feedback-text').fill(original+'\\n再確認メモ');await shot('feedback-dialog');await page.locator('#review-feedback-copy').click();await page.waitForFunction(()=>document.querySelector('#review-feedback-status').textContent.includes('コピーしました'));
  const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.endsWith('再確認メモ'));
  await page.locator('#review-feedback-close').click();await page.locator('#copy-motion').click();assert.ok((await page.locator('#review-feedback-text').inputValue()).endsWith('再確認メモ'));await page.locator('#review-feedback-close').click();
  return{transitions,sequence:f.sequence,globalTime:f.time,localTime:f.localTime,feedbackRetained:true};
 });
'''
p.write_text(s[:i]+new+s[i:])
