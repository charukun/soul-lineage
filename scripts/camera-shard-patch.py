from pathlib import Path
p=Path('scripts/browser/camera-playtest-task.mjs');s=p.read_text()
a="async function scenario(name,run){"
assert a in s
s=s.replace(a,"async function scenario(name,run){if(process.env.CAMERA_SCENARIO && process.env.CAMERA_SCENARIO!==name)return;")
a="assert.ok(receipt.requests.glb.some(r=>r.status===200));receipt.status='passed';"
assert a in s
s=s.replace(a,"assert.ok(receipt.scenarios.length>0);if(process.env.CAMERA_SCENARIO!=='review')assert.ok(receipt.requests.glb.some(r=>r.status===200));receipt.requestedScenario=process.env.CAMERA_SCENARIO||'all';receipt.status='passed';")
# Room stations can change coordinate spaces before reaching their point. Stop at
# the actually observed mode change, never steer toward a room-local point outside.
a="{steps=65,tolerance=.48}={}"
assert a in s;s=s.replace(a,"{steps=65,tolerance=.48,untilMode}={}")
a="if(!s)throw Error('missing camera snapshot');const p=s.actor.position"
assert a in s;s=s.replace(a,"if(!s)throw Error('missing camera snapshot');if(untilMode&&s.camera.mode===untilMode)return;const p=s.actor.position")
s=s.replace("walkTo(page,exit,{tolerance:.6})","walkTo(page,exit,{tolerance:.6,untilMode:'exploration'})")
s=s.replace("walkTo(page,door,{tolerance:.7})","walkTo(page,door,{tolerance:.7,untilMode:'interior'})")
p.write_text(s)
