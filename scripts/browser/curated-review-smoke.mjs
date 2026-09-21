import path from 'node:path';
import {expect} from '@playwright/test';
const assert=(value,message)=>{if(!value)throw new Error(message);};

// Playback controls live in the shared stage dialog. Exercise the same visible
// gear button as a player; never force-click controls hidden by the current UI.
async function openStageControls(page){
  const toggle=page.getByRole('button',{name:'表示・再生コントロール',exact:true});
  await expect(toggle).toBeVisible();
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(page.getByRole('dialog',{name:'表示・再生コントロール',exact:true})).toBeVisible();
}

export async function verifyCuratedReview({page,context,local,output,ledger,receipt}){
  const start=receipt.requests.length;
  await page.goto(local+'/review-objects',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!document.querySelector('#object-stage')?.dataset.loadedAsset,{},{timeout:60000});
  const initial=await page.locator('#object-stage').getAttribute('data-loaded-asset');
  const newModelRequests=receipt.requests.slice(start).filter(row=>ledger.files.some(asset=>asset.kind!=='audio'&&row.url.endsWith(asset.runtimePath)));
  assert(new Set(newModelRequests.map(row=>row.url)).size<=1,'Review preloads unselected model payloads');
  await page.locator('[data-category="creatures"]').click();
  const creatures=ledger.files.filter(asset=>asset.kind==='creature');
  await expect(page.locator('#object-options button')).toHaveCount(creatures.length);
  for(const asset of creatures){
    await page.locator(`[data-object="${asset.id}"]`).click();
    await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset',asset.id,{timeout:30000});
    await expect(page.locator('#object-animation')).toBeVisible();
    await expect(page.locator('#object-clip option')).toHaveCount(asset.inspection.animations.length);
    const index=Math.min(1,asset.inspection.animations.length-1);await page.locator('#object-clip').selectOption(String(index));
    await expect(page.locator('#object-stage')).toHaveAttribute('data-native-clip',asset.inspection.animations[index].name);
    await expect(page.locator('#object-provenance')).toContainText(asset.sha256);
    await expect(page.locator('#object-provenance')).toContainText(asset.author);
    await page.locator('#object-animation-toggle').click();
    await expect(page.locator('#object-animation-toggle')).toHaveAttribute('aria-pressed','true');
    await page.locator('#object-animation-toggle').click();
    await expect(page.locator('#object-animation-toggle')).toHaveAttribute('aria-pressed','false');
  }
  await page.locator('#object-stage').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(output,'review-creatures-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.locator('#object-options').evaluate(node=>({columns:getComputedStyle(node).gridTemplateColumns.split(/\s+/).length,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth}));
  assert(mobile.columns===5&&mobile.scrollWidth<=mobile.clientWidth+1,'Mobile review must retain five nonoverflowing columns');
  await page.locator('#object-stage').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'review-creatures-mobile.png')});
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#object-search').fill('no-such-asset-20260921');await expect(page.locator('#object-options button')).toHaveCount(0);
  await page.locator('#object-search').fill('');await page.locator('[data-category="props"]').click();
  await page.locator('#object-search').fill('barrel');await page.locator('[data-object="barrel"]').click();
  await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset','barrel');
  await expect(page.locator('#object-animation')).toBeHidden();
  await expect(page.locator('#object-status')).toContainText('KayKit Dungeon');
  // Search and stale-request handling must not replace a newer selection with an older parse.
  await page.locator('#object-search').fill('');await page.locator('[data-category="creatures"]').click();
  await page.locator(`[data-object="${creatures[0].id}"]`).dispatchEvent('click');
  await page.locator(`[data-object="${creatures.at(-1).id}"]`).dispatchEvent('click');
  await expect(page.locator('#object-stage')).toHaveAttribute('data-loaded-asset',creatures.at(-1).id,{timeout:30000});
  receipt.ui.push({route:'/review-objects',status:'passed',initial,lazyPayloads:new Set(newModelRequests.map(row=>row.url)).size,creatures:creatures.length,nativeClipSelectors:true,search:true,staleSelection:true,legacyBarrel:true,mobile});

  await page.goto(local+'/review-sound',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#sound-catalog .sound-option').first()).toBeVisible();
  const choices=await page.evaluate(async()=>{
    const {RINNE_SOUND_REVIEW_LIBRARY:items}=await import('/src/review-sound-catalog.js');
    const ids=['kenney-rpg-additions-','kenney-impact-additions-'];
    return [...ids.map(prefix=>items.find(item=>item.id.startsWith(prefix))),items.find(item=>item.kind==='sfx'&&!ids.some(prefix=>item.id.startsWith(prefix)))].map(item=>({id:item.id,title:item.title,url:item.url}));
  });
  await openStageControls(page);
  await page.locator('#sound-loop').check();
  for(const item of choices){
    await page.locator('#sound-search').fill(item.title);
    const button=page.locator('#sound-catalog .sound-option').filter({has:page.locator('strong',{hasText:item.title})}).first();
    await button.click();await expect(page.locator('#sound-id')).toHaveText(item.id);
    // Selecting a catalog entry legitimately dismisses the stage dialog.
    await openStageControls(page);
    await page.waitForFunction(()=>Number(document.querySelector('#sound-seek').max)>0,{},{timeout:15000});
    await page.locator('#sound-play').click();
    await page.waitForFunction(()=>document.querySelector('#sound-pulse').classList.contains('is-playing')||Number(document.querySelector('#sound-seek').value)>.001,{},{timeout:15000});
    const duration=await page.locator('#sound-seek').evaluate(node=>Number(node.max));assert(duration>0,'HTML audio metadata/playback missing');
    receipt.ui.push({route:'/review-sound',id:item.id,status:'passed',duration,actualHtmlAudioPlayback:true,stageControls:true,url:item.url});
    await page.locator('#sound-play').click();
  }
  await page.screenshot({path:path.join(output,'review-audio.png')});

  await page.goto(local+'/review-motion',{waitUntil:'domcontentloaded'});
  await openStageControls(page);
  await expect(page.locator('#motion-play')).toBeVisible();
  await expect(page.locator('#motion-play')).toBeEnabled({timeout:90000});
  await expect(page.locator('#motion-quality')).toHaveAttribute('data-state',/NATIVE|PLAYABLE|DEGRADED/);
  await page.waitForFunction(()=>Number(document.querySelector('#motion-time').value)>.03,{},{timeout:30000});
  const externalSelector='#motion-grid [data-motion-identity]';
  await page.waitForFunction(selector=>Array.from(document.querySelectorAll(selector)).some(node=>/kaykit-combat-melee|Rig_Medium_CombatMelee/.test(node.dataset.motionIdentity)),externalSelector,{timeout:90000});
  const identity=await page.locator(externalSelector).evaluateAll(nodes=>nodes.map(node=>node.dataset.motionIdentity).find(id=>/kaykit-combat-melee|Rig_Medium_CombatMelee/.test(id)));
  await page.locator(`#motion-grid [data-motion-identity=${JSON.stringify(identity)}]`).click();
  await openStageControls(page);
  await expect(page.locator('#motion-play')).toBeVisible();
  await expect(page.locator('#motion-play')).toBeEnabled({timeout:60000});
  await page.waitForFunction(()=>{
    const report=JSON.parse(document.querySelector('#motion-binding-report').textContent||'{}');
    return report.result?.applied===true&&report.source&&Number(document.querySelector('#motion-time').value)>.02;
  },{},{timeout:30000});
  const binding=await page.locator('#motion-binding-report').evaluate(node=>JSON.parse(node.textContent));
  assert(['PLAYABLE','DEGRADED'].includes(binding.result.status),'Existing retarget did not apply');
  receipt.ui.push({route:'/review-motion',status:'passed',identity,stageControls:true,retarget:binding.result,source:binding.source});
  await page.locator('#motion-stage').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'review-retarget.png')});

  await page.goto(local+'/review-effects',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#fx-metrics')).toContainText('backend ready',{timeout:90000});
  await openStageControls(page);
  await page.locator('[data-preset="slash"]').click();
  await page.waitForFunction(()=>/played [1-9]\d*/.test(document.querySelector('#fx-metrics').textContent),{},{timeout:30000});
  const metrics=await page.locator('#fx-metrics').textContent();
  const count=await page.locator('#fx-model-count').textContent();assert(Number.parseInt(count,10)>=307,'Existing VFX library shrank');
  await page.locator('#fx-stage').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'review-vfx.png')});
  receipt.ui.push({route:'/review-effects',status:'passed',metrics,count,stageControls:true,existingEffekseer:true});
  await page.goto('about:blank');
}
