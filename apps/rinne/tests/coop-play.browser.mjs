import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Invoked by the existing Rinne browser gate; no private session hooks or forged network state.
export async function verifyCoopPlay(browser,url,output){
  await mkdir(output,{recursive:true});
  const hostContext=await browser.newContext({viewport:{width:1100,height:760}}),guestContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const errors=[];let host=await hostContext.newPage();const guest=await guestContext.newPage();
  const observe=page=>{page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));};observe(host);observe(guest);
  const soloSaves=page=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.endsWith(':life-v2'))));
  const historySave=page=>page.evaluate(()=>{
    const id=document.getElementById('game')?.dataset.coopWorld;
    const entry=Object.entries(localStorage).find(([key])=>key.endsWith(`:coop-v2:${id}`));
    if(!entry)throw Error('RRP history record missing');const row=JSON.parse(entry[1]);
    return{version:row.version,epoch:row.checkpoint.world.epoch,root:row.root,births:row.history.filter(event=>event.type==='born').map(event=>event.lifeId)};
  });
  const sample=page=>page.locator('#game').evaluate(node=>({player:node.dataset.coopPlayer,epoch:Number(node.dataset.coopEpoch),tick:Number(node.dataset.coopTick),seconds:Number(node.dataset.coopSeconds),position:JSON.parse(node.dataset.coopPosition),peers:JSON.parse(node.dataset.coopPeers)}));
  async function invite(){await host.locator('#open-coop-game').click();await host.locator('#coop-invite').click();await host.waitForFunction(()=>document.getElementById('coop-link')?.value.includes('rinne-coop'));return host.locator('#coop-link').inputValue();}
  async function joinRoom(link){
    await guest.goto(link,{waitUntil:'domcontentloaded'});
    // Invite UI is opened only after the same prebooted world used by normal play is ready.
    // Match the established Rinne startup gate instead of classifying slow WebGL preboot as a missing dialog.
    await guest.locator('#title-screen').waitFor({state:'visible',timeout:45000});
    await guest.locator('#village-dialog[open]').waitFor({state:'visible',timeout:5000});await guest.locator('#coop-join').click();
    await guest.waitForFunction(()=>document.getElementById('coop-answer')?.value.length>0);const answer=await guest.locator('#coop-answer').inputValue();
    await host.locator('#coop-answer').fill(answer);await host.locator('#coop-accept').click();await host.locator('#close-village').click();
    await guest.waitForFunction(()=>document.getElementById('game')?.dataset.coopPlayer);await guest.locator('#village-dialog').waitFor({state:'hidden'});
    await host.waitForFunction(()=>document.getElementById('coop-people')?.textContent.includes('2人'));
  }
  try{
    await host.goto(url,{waitUntil:'domcontentloaded'});await host.locator('#title-screen').waitFor({state:'visible'});const beforeHost=await soloSaves(host);
    await guest.goto(url,{waitUntil:'domcontentloaded'});await guest.locator('#title-screen').waitFor({state:'visible'});const beforeGuest=await soloSaves(guest);
    await host.locator('#open-village').click();await host.locator('#coop-host').click();await host.locator('#open-coop-game').waitFor({state:'visible'});
    await joinRoom(await invite());const first=await sample(guest);assert.equal(first.epoch,1);assert.equal(await guest.locator('#clock-rate').isDisabled(),true);
    const owner=await sample(host);assert(first.peers.some(peer=>peer.id===owner.player));
    const recorded=await historySave(host);assert.equal(recorded.version,2);assert.equal(recorded.births.length,2);assert.match(recorded.root,/^[0-9a-f]{64}$/);
    await guest.keyboard.down('ArrowRight');await guest.waitForTimeout(700);await guest.keyboard.up('ArrowRight');
    await host.waitForFunction(({id,start})=>{const peer=JSON.parse(document.getElementById('game')?.dataset.coopPeers||'[]').find(peer=>peer.id===id);return peer&&Math.hypot(peer.position.x-start.x,peer.position.z-start.z)>.1;},{id:first.player,start:first.position});
    await host.locator('#clock-rate').selectOption('20');await guest.waitForFunction(()=>document.getElementById('clock-rate')?.value==='20');
    await guest.screenshot({path:join(output,'01-two-players.png')});assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await host.close();await guest.locator('#coop-darkness').waitFor({state:'visible',timeout:6000});const stopped=await sample(guest);await guest.waitForTimeout(300);assert.equal((await sample(guest)).tick,stopped.tick);
    await guest.screenshot({path:join(output,'02-host-loss.png')});
    host=await hostContext.newPage();observe(host);await host.goto(url,{waitUntil:'domcontentloaded'});await host.locator('#title-screen').waitFor({state:'visible'});
    await host.locator('#open-village').click();await host.locator('#coop-resume').click();await host.locator('#open-coop-game').waitFor({state:'visible'});
    await joinRoom(await invite());const resumed=await sample(guest);assert.equal(resumed.player,first.player);assert.equal(resumed.epoch,2);
    const restoredHistory=await historySave(host);assert.equal(restoredHistory.epoch,2);assert.deepEqual(restoredHistory.births,recorded.births);
    assert.deepEqual(await soloSaves(host),beforeHost);assert.deepEqual(await soloSaves(guest),beforeGuest);assert.deepEqual(errors,[]);
    await guest.locator('#back-title').click();await guest.locator('#title-screen').waitFor({state:'visible'});assert.equal(await guest.locator('#coop-darkness').isHidden(),true);
    await guest.locator('#new-life').click();await guest.waitForFunction(()=>document.getElementById('game')?.dataset.runtime==='active');assert.equal(await guest.locator('#game').getAttribute('data-coop-world'),null,'a solo life must not retain a room authority');
  }finally{await Promise.all([hostContext.close(),guestContext.close()]);}
}
