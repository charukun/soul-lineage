import {installPrivateSignalingHarness} from './private-signaling-harness.mjs';
import {expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {installPeerNetworkHarness} from './peer-network-harness.mjs';
const DETECTION_SLO_MS=4500,REOPEN_SLO_MS=6000;

async function device(browser,url){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{
    const Native=window.RTCPeerConnection;
    window.RTCPeerConnection=class extends Native{constructor(){super({iceServers:[]});}};
    const send=RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send=function(data){
      if(typeof data==='string'){try{const message=JSON.parse(data);if(message.type==='friend-village')window.__FRIEND_VISIT_MESSAGE__=message;}catch{}}
      return send.call(this,data);
    };
  });
  if(url){const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});if(!response?.ok())throw new Error(`Peer device returned HTTP ${response?.status()}`);}
  return{context,page,errors};
}

export async function friendVisit(browser,url,{automatic=false}={}){
  const host=await device(browser,url),guest=await device(browser);
  const signaling=await installPrivateSignalingHarness([host.context,guest.context],{available:automatic});
  try{
    await host.page.waitForFunction(()=>document.querySelector('#game')?.dataset.renderer==='ready',null,{timeout:45000});
    await host.page.locator('#muraEnterVillage').click();
    await host.page.locator('#muraSettingsButton').click();await host.page.locator('#onlineOpen').click();
    await expect(host.page.locator('#onlineDialog')).toBeVisible();
    await host.page.locator('#make-offer').click();
    await host.page.waitForFunction(()=>document.querySelector('#invite')?.value?.includes('friend-village'),null,{timeout:20000});
    if(automatic)await host.page.waitForFunction(()=>{const hash=new URL(document.querySelector('#invite').value).hash.slice(1),value=new URLSearchParams(hash).get('friend-village');return JSON.parse(decodeURIComponent(value)).signaling?.version===1;},null,{timeout:10000});
    const invitation=await host.page.locator('#invite').inputValue();
    await guest.page.goto(invitation,{waitUntil:'domcontentloaded'});
    await guest.page.locator('#friend-connect').click();
    await guest.page.waitForFunction(()=>document.querySelector('#friend-answer')?.value?.length>20,null,{timeout:20000});
    if(!automatic){await host.page.locator('#answer').fill(await guest.page.locator('#friend-answer').inputValue());await host.page.locator('#accept-answer').click();}
    else await expect(host.page.locator('#answer')).toHaveValue('');
    await guest.page.waitForFunction(()=>document.body.classList.contains('visiting'),null,{timeout:20000});
    await expect(guest.page.locator('.soul-world-darkness')).toHaveAttribute('data-phase','open');
    const shared=await host.page.evaluate(()=>window.__FRIEND_VISIT_MESSAGE__);
    expect(Object.keys(shared.snapshot).sort()).toEqual(['clock','name','objects','version','villageId']);
    expect(shared.snapshot.objects.every(o=>Array.isArray(o.room)&&o.room.length===0)).toBe(true);
    expect(shared.welcome.authority.members[shared.welcome.selfId].eligible).toBe(false);
    expect(shared.welcome.authority.checkpoint).toBeNull();
    await host.context.close();
    await expect(guest.page.locator('.soul-world-darkness')).toHaveAttribute('data-phase','closed',{timeout:15000});
    const errors=[...host.errors,...guest.errors];if(errors.length)throw new Error(`Friend visit errors: ${JSON.stringify(errors)}`);
    if(automatic){expect(signaling.calls().some(call=>call.path.endsWith('/answer'))).toBe(true);expect(signaling.snapshot().rooms.every(room=>!room.roomId&&!room.worldId)).toBe(true);}
    return {automaticAnswer:automatic,inviteOnly:true,exteriorOnly:true,visitorHostEligible:false,ownerLoss:'closed',errors};
  }catch(error){error.message+='\nFriend evidence: '+JSON.stringify(await Promise.all([host,guest].map(d=>d.page.evaluate(()=>({url:location.href.split('#')[0],status:document.querySelector('#net-state')?.textContent||document.querySelector('#friend-state')?.textContent,phase:document.querySelector('.soul-world-darkness')?.dataset.phase,visiting:document.body.classList.contains('visiting')})).catch(()=>null))));throw error;}finally{await host.context.close().catch(()=>{});await guest.context.close();}
}

export async function eligiblePeerMigration(browser){
  const devices=[];
  try{
    for(const id of ['a','b','c']){const d=await device(browser);devices.push(d);await installPeerNetworkHarness(d.page,id);}
    const [a,b,c]=devices;
    for(const [id,d]of [['b',b],['c',c]]){
      const offer=await a.page.evaluate(id=>window.__PEER_NETWORK_TEST__.offer(id),id);
      const answer=await d.page.evaluate(offer=>window.__PEER_NETWORK_TEST__.answer('a',offer),offer);
      await a.page.evaluate(({id,answer})=>window.__PEER_NETWORK_TEST__.accept(id,answer),{id,answer});
      await a.page.waitForFunction(id=>window.__PEER_NETWORK_TEST__.ready(id),id);
    }
    await a.page.evaluate(()=>window.__PEER_NETWORK_TEST__.start());
    for(const d of [b,c])await d.page.waitForFunction(()=>window.__PEER_NETWORK_TEST__.snapshot().mesh.connected.length===1,null,{timeout:20000});
    const crashAt=await b.page.evaluate(()=>performance.now());
    await a.page.evaluate(()=>window.__PEER_NETWORK_TEST__.crash());
    for(const d of [b,c])await d.page.waitForFunction(()=>{const s=window.__PEER_NETWORK_TEST__.snapshot();return s.node.phase==='open'&&s.node.hostId==='b';},null,{timeout:15000});
    const afterCrash=await b.page.evaluate(()=>window.__PEER_NETWORK_TEST__.snapshot());
    const migrating=afterCrash.phaseTimes.find(event=>event.phase==='migrating'&&event.at>=crashAt),opened=afterCrash.phaseTimes.find(event=>migrating&&event.phase==='open'&&event.at>=migrating.at);
    const detectionMs=migrating?migrating.at-crashAt:Infinity,reopenMs=opened?opened.at-migrating.at:Infinity;
    expect(detectionMs).toBeLessThanOrEqual(DETECTION_SLO_MS);expect(reopenMs).toBeLessThanOrEqual(REOPEN_SLO_MS);
    expect(afterCrash.history).toContain('migrating');expect(afterCrash.restored).toContain(7);expect(afterCrash.node.epoch).toBe(2);
    await b.page.evaluate(()=>window.__PEER_NETWORK_TEST__.checkpoint(8));
    await c.page.waitForFunction(()=>window.__PEER_NETWORK_TEST__.snapshot().node.checkpointRevision>=2);
    expect(await b.page.evaluate(()=>window.__PEER_NETWORK_TEST__.handoff())).toBe(true);
    await c.page.waitForFunction(()=>{const s=window.__PEER_NETWORK_TEST__.snapshot();return s.node.phase==='open'&&s.node.hostId==='c';},null,{timeout:10000});
    const final=await c.page.evaluate(()=>window.__PEER_NETWORK_TEST__.snapshot());
    expect(final.node.epoch).toBe(3);expect(final.restored).toContain(8);
    const errors=devices.flatMap(d=>d.errors);if(errors.length)throw new Error(`Peer browser errors: ${JSON.stringify(errors)}`);
    return {detectionMs,reopenMs,slo:{detectionMs:DETECTION_SLO_MS,reopenMs:REOPEN_SLO_MS,pass:true},crashSuccessor:'b',gracefulSuccessor:'c',crashEpoch:afterCrash.node.epoch,finalEpoch:final.node.epoch,checkpointRevision:final.node.checkpointRevision,bHistory:afterCrash.history,cHistory:final.history,errors};
  }catch(error){error.message+='\nPeer evidence: '+JSON.stringify(await Promise.all(devices.map(d=>d.page.evaluate(()=>window.__PEER_NETWORK_TEST__?.snapshot()).catch(()=>null))));throw error;}finally{for(const d of devices)await d.context.close();}
}

export async function verifyPeerHostMigration(browser,url,evidence){
  const friend=await friendVisit(browser,url);
  const automaticFriend=await friendVisit(browser,url,{automatic:true});
  const migration=await eligiblePeerMigration(browser);
  const report={ok:true,friend,automaticFriend,migration,scope:'Real friend UI + exact shared-network sources over native WebRTC in independent Chromium contexts; no physical-device claim'};
  if(evidence?.outputPath)writeFileSync(evidence.outputPath('peer-host-migration.json'),JSON.stringify(report,null,2));
  return report;
}
