/** Explicit specialist regression. Real native catalog inputs plus an existing saved-editor document. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReviewCohort, reviewSettings } from '../src/review/character/state.js';
import { WORKSPACE_KEY, serializeWorkspace } from '../src/review/workspace/state.js';

export function heroineSavedWorkspaceFixture() {
  const settings = reviewSettings({ view:'single', age:22, ages:'fixed', count:6, selected:0, outfit:'original' });
  const records = createReviewCohort(settings);
  return serializeWorkspace({ settings, records, note:'Saved editor compatibility regression' }, [
    [records[0].id, { version:1, face:'classic', hair:'tail', body:'balanced', outfit:'tunic', accessory:'none' }]
  ], { reference:false });
}

export async function verifyFemaleProtagonistVisibility(browser, baseURL, output, { expectBroken=false, projectRoot=null, fixture=heroineSavedWorkspaceFixture() } = {}) {
  await mkdir(output,{recursive:true});
  const context = await browser.newContext({
    viewport:{width:393,height:740}, deviceScaleFactor:2, isMobile:true, hasTouch:true,
    storageState:{cookies:[],origins:[{origin:new URL(baseURL).origin,localStorage:[{name:WORKSPACE_KEY,value:fixture}]}]}
  });
  const errors=[], requests=[], rows=[];
  if (projectRoot) await context.route('https://soul-lineage-*.c-okamoto.workers.dev/**', async route => {
    const u=new URL(route.request().url());let base,relative;
    if(u.pathname.startsWith('/library/')){base=path.resolve(projectRoot,'apps/review/public/library');relative=u.pathname.slice('/library/'.length);}
    else if(u.pathname.startsWith('/simulator/assets/kaykit/')){base=path.resolve(projectRoot,'apps/character-studio/public/simulator/assets/kaykit');relative=u.pathname.slice('/simulator/assets/kaykit/'.length);}
    else return route.continue();
    const file=path.resolve(base,decodeURIComponent(relative));assert.ok(file.startsWith(base+path.sep));
    try{await route.fulfill({body:await readFile(file),contentType:file.endsWith('.json')?'application/json':'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});}
    catch(error){errors.push(error.message);await route.abort();}
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(/\.glb|\.asset\.json/.test(r.url()))requests.push({url:r.url(),status:r.status()});});
  const select=async id=>{
    await page.locator(`.character-model-card[data-model-key="${id}"]`).click();
    await page.waitForFunction(id=>window.masterCharacterReview?.ready&&window.masterCharacterReview.audit?.modelId===id,id,{timeout:90000});
  };
  const camera=async name=>{await page.locator(`[data-camera="${name}"]`).first().click();};
  async function capture(name) {
    // Let the ordinary load feedback finish; never hide it or fix the model from the test.
    await page.waitForTimeout(3100);
    await page.locator('#stage').screenshot({path:path.join(output,name+'.png')});
    const state=await page.evaluate(()=>{
      const r=window.masterCharacterReview, actor=r.actors[r.settings.selected], meshes=[];
      actor.root.traverse(o=>{if(!o.isMesh)return;
        let inheritedVisible=true;for(let p=o;p;p=p.parent)inheritedVisible&&=p.visible;
        meshes.push({name:o.name,visible:o.visible,inheritedVisible,vertices:o.geometry.attributes.position.count,
          materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,visible:m.visible,opacity:m.opacity,color:m.color?.getHexString(),map:m.map?.name}))});
      });
      return {audit:r.audit,errors:r.errors,bodyClass:document.body.className,settings:r.settings,meshes,
        hasModularController:Boolean(actor.appearanceController),workspace:JSON.parse(window.characterStudio.workspace.snapshot()),storage:JSON.parse(localStorage.getItem('rinne.character-studio.workspace.v1'))};
    });
    await writeFile(path.join(output,name+'.json'),JSON.stringify(state,null,2));rows.push({name,...state});
    const saved=JSON.parse(fixture);
    assert.deepEqual(state.workspace.parts,saved.parts,'catalog must not erase stored editor parts');
    assert.deepEqual(state.workspace.session.records,saved.session.records,'catalog must not mutate saved individuals');
    assert.deepEqual(state.storage.parts,saved.parts,'persistent editor parts survive selection and reload');
    assert.equal(state.workspace.quality.reference,false);
    assert.deepEqual(state.errors,[]);
    if(state.audit.modelId==='protagonist.villager.female.v1') {
      assert.equal(state.audit.source.sha256,'777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678');
      const authored=state.meshes.filter(m=>m.materials.some(x=>x.name==='HeroineDawn_SoftClothAndHair'));
      assert.equal(authored.length,19,'all authored surfaces remain in the scene');
      if(expectBroken) {
        assert.ok(authored.every(m=>m.materials.every(x=>x.visible===false)),'baseline must reproduce the actual all-body hiding bug');
        assert.ok(state.meshes.some(m=>m.name.startsWith('mc-part:')),'baseline leaves only legacy generated hair/garment');
        assert.equal(state.hasModularController,true);
      } else {
        assert.ok(authored.every(m=>m.inheritedVisible&&m.materials.every(x=>x.visible&&x.opacity===1&&x.color==='ffffff')),'authored body must remain fully visible and untinted');
        assert.equal(state.hasModularController,false,'the source-only catalog must not attach editor replacement parts');
        assert.equal(state.meshes.some(m=>m.name.startsWith('mc-part:')),false);
      }
    } else if(!expectBroken) {
      assert.equal(state.hasModularController,false,'source-only applies to other catalog choices too');
      assert.ok(state.meshes.every(m=>m.materials.every(x=>x.visible)));
    }
  }
  try {
    await page.goto(baseURL,{waitUntil:'networkidle',timeout:90000});
    await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.characterStudio?.workspace,null,{timeout:90000});
    const version=await page.evaluate(async()=>{try{return await(await fetch('/version.json',{cache:'no-store'})).json();}catch{return null;}});
    await select('protagonist.villager.female.v1');await camera('front');await capture('front');
    if(!expectBroken){
      for(const view of ['side','back','face']){await camera(view);await capture(view);}
      await select('kaykit.rogue.v1');await capture('rogue');
      await select('protagonist.villager.female.v1');await camera('front');await capture('reselected');
      await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.characterStudio?.workspace,null,{timeout:90000});
      await select('protagonist.villager.female.v1');await camera('front');await capture('reloaded');
      await page.setViewportSize({width:1440,height:1050});await camera('overview');await capture('desktop-three-quarter');
    }
    await page.screenshot({path:path.join(output,'page.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    const receipt={schema:'rinne-heroine-saved-visibility-regression',url:baseURL,version,checkoutSha:process.env.GITHUB_SHA,
      expectedFailureReproduced:expectBroken,fixtureSha256:createHash('sha256').update(fixture).digest('hex'),
      modelSha256:rows[0].audit.source.sha256,views:rows.map(r=>r.name),errors,requests,
      delivery:projectRoot?'exact-checkout first-party origin bytes':'public canonical root, no response substitution',
      operations:'saved valid workspace -> ordinary page load -> native model cards/camera buttons -> reload; no visibility/configure repair from probe',
      physicalDevicePerformance:'not-measured'};
    await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));
    await writeFile(path.join(output,'saved-workspace.json'),fixture);
    return receipt;
  } catch(error) {
    await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
    await writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,errors,requests},null,2));throw error;
  } finally { await context.close(); }
}
