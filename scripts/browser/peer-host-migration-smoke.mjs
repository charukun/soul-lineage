import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const DETECTION_SLO_MS=4500,REOPEN_SLO_MS=6000;

async function prepareDevice(browser,url){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
    const Native=window.RTCPeerConnection;
    if(!Native)return;
    window.RTCPeerConnection=class LocalOnlyRTCPeerConnection extends Native{constructor(){super({iceServers:[]});}};
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  if(!response?.ok())throw new Error(`Peer device returned HTTP ${response?.status()}`);
  await page.waitForFunction(()=>document.querySelector('#game')?.dataset.renderer==='ready',null,{timeout:45000});
  return{context,page,errors};
}

async function openOnline(page){
  await page.locator('#more').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#onlineOpen').click();
  await expect(page.locator('#onlineDialog')).toBeVisible();
  await page.waitForSelector('#peer-world-host',{timeout:10000});
}

async function joinStandby(host,guest){
  await host.page.locator('#peer-world-host-offer').evaluate(el=>{el.value='';});
  await guest.page.locator('#peer-world-answer').evaluate(el=>{el.value='';});
  await host.page.locator('#peer-world-make-offer').click();
  await host.page.waitForFunction(()=>document.querySelector('#peer-world-host-offer')?.value?.length>20,null,{timeout:20000});
  const offer=await host.page.locator('#peer-world-host-offer').inputValue();
  await guest.page.locator('#peer-world-offer').fill(offer);
  await guest.page.locator('#peer-world-join').click();
  await guest.page.waitForFunction(()=>document.querySelector('#peer-world-answer')?.value?.length>20,null,{timeout:20000});
  const answer=await guest.page.locator('#peer-world-answer').inputValue();
  await host.page.locator('#peer-world-host-answer').fill(answer);
  await host.page.locator('#peer-world-accept').click();
  await guest.page.waitForFunction(()=>window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.node?.phase==='open',null,{timeout:20000});
}

export async function verifyPeerHostMigration(browser,url,evidence){
  const devices=[];
  try{
    const host=await prepareDevice(browser,url),b=await prepareDevice(browser,url),c=await prepareDevice(browser,url);devices.push(host,b,c);
    await Promise.all(devices.map(d=>openOnline(d.page)));
    await host.page.locator('#peer-world-host').click();
    await host.page.waitForFunction(()=>window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.node?.hostId===window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.selfId,null,{timeout:10000});
    await joinStandby(host,b);await joinStandby(host,c);
    await host.page.waitForFunction(()=>Object.keys(window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.node?.authority?.members||{}).length===3,null,{timeout:10000});
    await Promise.all([b.page,c.page].map(page=>page.waitForFunction(()=>window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.mesh?.connected?.length>=1,null,{timeout:20000})));
    for(const device of [b,c])await device.page.evaluate(()=>{window.__PEER_PHASE_HISTORY__=[];window.__PEER_CRASH_MARK__=null;const root=document.querySelector('.soul-world-darkness');const record=()=>window.__PEER_PHASE_HISTORY__.push({phase:root?.dataset.phase||'open',at:performance.now()});record();if(root)new MutationObserver(record).observe(root,{attributes:true,attributeFilter:['data-phase']});});
    const bId=await b.page.evaluate(()=>window.__VILLAGE_PEER_HOSTED_WORLD__.snapshot().selfId);
    const cId=await c.page.evaluate(()=>window.__VILLAGE_PEER_HOSTED_WORLD__.snapshot().selfId);
    await Promise.all([b.page,c.page].map(page=>page.evaluate(()=>{window.__PEER_CRASH_MARK__=performance.now();})));
    await host.page.evaluate(()=>window.__VILLAGE_PEER_HOSTED_WORLD__.crashForDiagnostics());
    await b.page.waitForFunction(id=>{const s=window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot();return s?.node?.phase==='open'&&s.node.hostId===id;},bId,{timeout:15000});
    await c.page.waitForFunction(id=>window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.node?.hostId===id,bId,{timeout:15000});
    const afterCrash=await b.page.evaluate(()=>({history:window.__PEER_PHASE_HISTORY__,crashAt:window.__PEER_CRASH_MARK__,paused:window.__VILLAGE_SIMULATION_PAUSED__,remote:window.__VILLAGE_REMOTE_WORLD_ACTIVE__,snapshot:window.__VILLAGE_PEER_HOSTED_WORLD__.snapshot()}));
    const migrating=afterCrash.history.find(row=>row.phase==='migrating'&&row.at>=afterCrash.crashAt),opened=afterCrash.history.find(row=>migrating&&row.phase==='open'&&row.at>migrating.at);
    const detectionMs=migrating?migrating.at-afterCrash.crashAt:Infinity,reopenMs=migrating&&opened?opened.at-migrating.at:Infinity;
    if(!migrating||!opened||afterCrash.paused!==false||afterCrash.remote!==true)throw new Error(`Darkness failover evidence invalid: ${JSON.stringify(afterCrash)}`);
    if(detectionMs>DETECTION_SLO_MS||reopenMs>REOPEN_SLO_MS)throw new Error(`Host migration SLO exceeded: ${JSON.stringify({detectionMs,reopenMs,targets:{detectionMs:DETECTION_SLO_MS,reopenMs:REOPEN_SLO_MS}})}`);
    const inheritedRevision=afterCrash.snapshot.node.revision;
    await b.page.waitForFunction(revision=>window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.node?.revision>revision,inheritedRevision,{timeout:7000});
    await c.page.waitForFunction(revision=>window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot()?.node?.revision>revision,inheritedRevision,{timeout:7000});
    await host.context.close();devices.splice(devices.indexOf(host),1);
    await b.page.locator('#peer-world-handoff').click();
    await c.page.waitForFunction(id=>{const s=window.__VILLAGE_PEER_HOSTED_WORLD__?.snapshot();return s?.node?.phase==='open'&&s.node.hostId===id;},cId,{timeout:10000});
    const final=await c.page.evaluate(()=>({paused:window.__VILLAGE_SIMULATION_PAUSED__,remote:window.__VILLAGE_REMOTE_WORLD_ACTIVE__,snapshot:window.__VILLAGE_PEER_HOSTED_WORLD__.snapshot(),history:window.__PEER_PHASE_HISTORY__}));
    if(final.paused!==false||final.snapshot.node.hostId!==cId)throw new Error(`Graceful handoff evidence invalid: ${JSON.stringify(final)}`);
    const report={ok:true,crashSuccessor:bId,gracefulSuccessor:cId,crashEpoch:afterCrash.snapshot.node.epoch,finalEpoch:final.snapshot.node.epoch,checkpointRevision:final.snapshot.node.revision,detectionMs:Math.round(detectionMs),reopenMs:Math.round(reopenMs),slo:{detectionMs:DETECTION_SLO_MS,reopenMs:REOPEN_SLO_MS,pass:true},bHistory:afterCrash.history,cHistory:final.history,errors:[...host.errors,...b.errors,...c.errors]};
    if(report.errors.length)throw new Error(`Peer browser page errors: ${JSON.stringify(report.errors)}`);
    if(evidence?.outputPath)writeFileSync(evidence.outputPath('peer-host-migration.json'),JSON.stringify(report,null,2));
    return report;
  }finally{
    for(const device of devices)await device.context.close().catch(()=>{});
  }
}
