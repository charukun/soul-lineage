// Additional assertions for the existing NOCTURNE specialist browser evidence.
import assert from 'node:assert/strict';

export async function assertBattle2Frame(page,{title='序破急バトルシステム'}={}){
  await page.waitForFunction(()=>{
    const stage=document.querySelector('[data-review-surface="battle2"]'),canvas=document.getElementById('world'),fx=document.getElementById('effects'),header=document.querySelector('.review-surface__header');
    if(!stage||!canvas||!fx||!header)return false;
    const s=stage.getBoundingClientRect(),c=canvas.getBoundingClientRect(),h=header.getBoundingClientRect();
    return c.width>0&&c.height>0&&c.top>=h.bottom&&Math.abs(c.width-stage.clientWidth)<2&&Math.abs(c.height-stage.clientHeight)<2&&Math.abs(canvas.width/c.width-canvas.height/c.height)<.02&&fx.width===canvas.width&&fx.height===canvas.height;
  },{},{timeout:15000});
  const geometry=await page.evaluate(()=>{
    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const c=document.getElementById('world'),s=document.querySelector('[data-review-surface="battle2"]');
    return {viewport:{width:innerWidth,height:innerHeight},frame:box('.review-surface'),header:box('.review-surface__header'),stage:box('[data-review-surface="battle2"]'),canvas:box('#world'),position:getComputedStyle(s).position,canvasWidth:c.width,canvasHeight:c.height,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
  });
  assert.equal(geometry.position,'relative');assert.equal(geometry.overflow,false);
  assert.ok(geometry.stage.y>=geometry.header.bottom,'Frame header must not overlap the game');
  assert.ok(geometry.canvas.x>=geometry.stage.x&&geometry.canvas.right<=geometry.stage.right+1);
  assert.ok(geometry.canvas.y>=geometry.stage.y&&geometry.canvas.bottom<=geometry.stage.bottom+1);
  assert.ok(geometry.stage.bottom>=geometry.frame.bottom-14,'No empty control-panel or mobile grid row');
  assert.ok(geometry.stage.height>geometry.viewport.height*.7,'Render region should occupy the available frame');
  assert.equal(await page.locator('.review-surface__title h1').innerText(),title);
  assert.equal(await page.locator('.review-surface__title h1').isVisible(),true);
  assert.equal(await page.locator('.review-surface__back').isVisible(),true);
  assert.equal(await page.locator('.review-surface__panel').count(),0);
  return geometry;
}

export async function exerciseBattle2Switcher(page,{origin,out,name}){
  const toggle=page.locator('[data-review-switcher]>summary');await toggle.click();
  assert.equal(await page.locator('.review-switcher[open]').count(),1);
  const cards=page.locator('.review-switcher__grid>.review-probe-card');assert.equal(await cards.count(),7);
  assert.equal(await cards.nth(6).locator('strong').innerText(),'序破急バトル');
  assert.equal(await cards.nth(6).getAttribute('href'),origin+'/battle2');
  assert.equal(await cards.nth(6).getAttribute('aria-current'),'page');
  assert.equal(await page.locator('.review-surface__back').getAttribute('href'),origin+'/');
  const menu=await page.locator('.review-switcher__panel').evaluate(node=>{
    const r=node.getBoundingClientRect(),grid=node.querySelector('.review-switcher__grid');
    return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,viewportWidth:innerWidth,viewportHeight:innerHeight,hit:node.contains(document.elementFromPoint(r.x+Math.min(20,r.width/2),r.y+20))};
  });
  assert.equal(menu.columns,6);assert.equal(menu.hit,true,'Menu must be above the canvas');
  assert.ok(menu.x>=0&&menu.right<=menu.viewportWidth&&menu.bottom<=menu.viewportHeight);
  await page.screenshot({path:out+'/'+name+'-menu.png'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('.review-switcher[open]').count(),0);
  await toggle.click();await page.locator('#world').click({position:{x:15,y:15}});assert.equal(await page.locator('.review-switcher[open]').count(),0,'Outside click closes common navigation');
  return menu;
}
