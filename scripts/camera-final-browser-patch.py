from pathlib import Path
p=Path('scripts/browser/camera-playtest-task.mjs');s=p.read_text()
# Keep every acceptance assertion. The old one-axis 3-frame pulse controller
# released input on every sample while the live battle also owns footwork.
# Use continuously-held native directional keys and record the path instead.
needle="async function boot(page,life)"
assert needle in s
s=s.replace(needle,"""async function walkBattle(page,goal,{steps=120,tolerance=.48}={}){
  await gameFocus(page);const held=new Set(),path=[];
  try{
    for(let i=0;i<steps;i++){
      const s=await snapshot(page),p=s.actor.position,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);path.push({i,d,state:s});
      if(d<tolerance)return;
      const c=s.camera,fx=c.lookTarget.x-c.position.x,fz=c.lookTarget.z-c.position.z,n=Math.hypot(fx,fz),forward=(dx*fx+dz*fz)/n,right=(-dx*fz+dz*fx)/n;
      const wanted=new Set();if(Math.abs(forward)>d*.22)wanted.add(forward>0?'ArrowUp':'ArrowDown');if(Math.abs(right)>d*.22)wanted.add(right>0?'ArrowRight':'ArrowLeft');
      for(const k of [...held])if(!wanted.has(k)){await page.keyboard.up(k);held.delete(k);}
      for(const k of wanted)if(!held.has(k)){await page.keyboard.down(k);held.add(k);}
      await frames(page,6);
    }
    throw Error('Native continuous battle traversal failed '+JSON.stringify({goal,last:path.at(-1)}));
  }finally{for(const k of held)await page.keyboard.up(k);await writeFile(`${out}/battle-native-path.json`,JSON.stringify(path));}
}
"""+needle)
needle="await scenario('combat',async page=>{const life=baseLife();"
assert needle in s
s=s.replace(needle,"await scenario(process.env.CAMERA_SCENARIO==='driven'?'driven':'combat',async page=>{const driven=process.env.CAMERA_SCENARIO==='driven',life=baseLife();if(driven)life.equipment={weapon:'sword',armor:'heavy',shield:false};")
needle="await boot(page,life);await page.waitForFunction(()=>document.getElementById('game').cameraPresentation?.()?.camera.mode==='combat');const s=await shot(page,'combat-sword-shield');"
assert needle in s
s=s.replace(needle,"""await boot(page,life);
  if(driven){await expect(page.locator('#game')).toHaveAttribute('data-battle-presentation','johakyu',{timeout:90000});await page.waitForFunction(()=>document.getElementById('game').cameraPresentation?.()?.renderer==='johakyu-driven');}
  await page.waitForFunction(()=>document.getElementById('game').cameraPresentation?.()?.camera.mode==='combat');await frames(page,10);const s=await shot(page,driven?'johakyu-shared-director':'combat-sword-shield');
  if(driven){assert.equal(s.renderer,'johakyu-driven');assert.equal(s.actorRuntime,'3d');assert.equal(s.camera.profile,'current3d');assert.ok(Number.isFinite(s.playerView.relativeYaw));}
""")
needle="await walkTo(page,{x:-5,z:-4},{steps:55});await shot(page,'combat-retreat');"
assert needle in s
s=s.replace(needle,"""await gameFocus(page);
  if(driven){const before=await snapshot(page),sequence=record(page,1800);await page.mouse.move(420,240);await page.mouse.down({button:'right'});await page.mouse.move(550,240,{steps:12});await page.mouse.up({button:'right'});await frames(page,12);const turned=await shot(page,'johakyu-camera-orbit');assert.ok(Math.abs(turned.yawOffset-before.yawOffset)>.6);assert.equal(turned.renderer,'johakyu-driven');await writeFile(`${out}/johakyu-orbit-frames.json`,JSON.stringify(await sequence));await page.keyboard.press('Alt+Home');}
  await walkBattle(page,{x:-5,z:-4});await shot(page,driven?'johakyu-native-retreat':'combat-retreat');""")
# Establish screenshot/transition fixtures from actual final source bytes.
# Additional diagnostics are read-only, never game commands or injected state.
s=s.replace("await page.screenshot({path:`${out}/${name}.png`});const state=", "await page.screenshot({path:`${out}/${name}.png`});const state=")
p.write_text(s)
