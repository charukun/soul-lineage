from pathlib import Path
p=Path('scripts/browser/camera-playtest-task.mjs');s=p.read_text()
a="async function hold(page,key,ms=200){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}"
b="""async function frames(page,number=4){await page.evaluate(number=>new Promise(resolve=>{let n=0;const step=()=>{if(++n>=number)resolve();else requestAnimationFrame(step);};requestAnimationFrame(step);}),number);}
async function gameFocus(page){for(let i=0;i<8;i++){const tag=await page.evaluate(()=>document.activeElement?.tagName);if(!['INPUT','TEXTAREA','SELECT'].includes(tag))return;await page.keyboard.press('Tab');}throw Error('native focus is still in a form field');}
async function hold(page,key,ms=200){await gameFocus(page);await page.keyboard.down(key);try{await frames(page,Math.max(3,Math.ceil(ms/100)));}finally{await page.keyboard.up(key);}await frames(page,1);}"""
assert a in s;s=s.replace(a,b)
s=s.replace("if(t-start>=ms)resolve(rows);", "if(t-start>=ms&&rows.length>=16)resolve(rows);")
s=s.replace("viewport:{width:1100,height:800}","viewport:{width:900,height:650}").replace("size:{width:1100,height:800}","size:{width:900,height:650}")
s=s.replace("setViewportSize({width:1100,height:800})","setViewportSize({width:900,height:650})")
s=s.replace("const before=await snapshot(page);const frames=record(page,1600);", "await gameFocus(page);const before=await snapshot(page);const rotationFrames=record(page,1600);")
s=s.replace("await page.waitForTimeout(1100);const after", "await frames(page,8);const after")
s=s.replace("JSON.stringify(await frames));", "JSON.stringify(await rotationFrames));",1)
s=s.replace("await page.waitForTimeout(1500);await shot(page,'exploration-mobile');", "await frames(page,8);await shot(page,'exploration-mobile');")
s=s.replace("await page.waitForTimeout(1500);await shot(page,'combat-mobile');", "await frames(page,8);await shot(page,'combat-mobile');")
s=s.replace("const frames=record(page,14000);", "const interiorFrames=record(page,65000);")
s=s.replace("await page.waitForTimeout(1000);await shot(page,'interior-exit-spear');", "await frames(page,8);await shot(page,'interior-exit-spear');")
s=s.replace("await hold(page,'ArrowDown',450);await shot(page,'interior-entry');await writeFile(`${out}/interior-transition-frames.json`,JSON.stringify(await frames));", "await walkTo(page,{x:0,z:0},{steps:18,tolerance:.6});await frames(page,6);await shot(page,'interior-entry');await writeFile(`${out}/interior-transition-frames.json`,JSON.stringify(await interiorFrames));")
s=s.replace("let found=false;for(let i=0;i<28;i++){await page.keyboard.press('Alt+ArrowRight');await page.waitForTimeout(240);", "await gameFocus(page);let found=false;for(let i=0;i<48;i++){await page.keyboard.press('Alt+ArrowLeft');await frames(page,2);")
s=s.replace("await page.waitForTimeout(600);await shot(page,'foreground-fade');", "await frames(page,8);await shot(page,'foreground-fade');")
s=s.replace("await page.keyboard.press('Alt+Home');await shot(page,'foreground-restored-bearing');", "await page.keyboard.press('Alt+Home');await page.waitForFunction(()=>document.getElementById('game').cameraPresentation?.()?.camera.screenSafety.occludedRatio===0);await frames(page,8);await shot(page,'foreground-restored-bearing');")
s=s.replace("try{await run(page);}catch(e)", "try{console.log('CAMERA_SCENARIO_START '+name);await run(page);console.log('CAMERA_SCENARIO_PASS '+name);}catch(e)")
s=s.replace("receipt.failures.push({name,error:e.stack});", "console.log('CAMERA_SCENARIO_FAIL '+name+' '+e.message);receipt.failures.push({name,error:e.stack});")
p.write_text(s)
