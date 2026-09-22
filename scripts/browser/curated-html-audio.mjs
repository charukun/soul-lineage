import assert from 'node:assert/strict';

// Observe the real HTMLAudioElement. Do not stub play(), alter its clock,
// dispatch media events or change application playback state.
export async function installHtmlAudioObservation(page){
  await page.addInitScript(()=>{
    const players=[];
    Object.defineProperty(window,'__curatedHtmlAudioPlayers',{value:players});
    window.Audio=new Proxy(window.Audio,{construct(target,args,newTarget){
      const player=Reflect.construct(target,args,newTarget);
      players.push(player);
      return player;
    }});
  });
}

export async function verifyHtmlAudioPlayback(page,item){
  // Read native metadata, not the range's fallback max=1 before load finishes.
  await page.waitForFunction(url=>window.__curatedHtmlAudioPlayers?.some(player=>
    player.currentSrc===url&&player.readyState>=1&&Number.isFinite(player.duration)&&
    player.duration>0&&player.loop&&!player.error),item.url,{timeout:15000});
  await page.evaluate(url=>{
    const player=window.__curatedHtmlAudioPlayers.find(player=>player.currentSrc===url);
    const record={url,duration:player.duration,loop:player.loop,playingEvents:0,
      advancingSamples:0,maxCurrentTime:0,uiPlayingObserved:false,paused:false};
    let active=true,frame;
    const playing=()=>record.playingEvents++;
    player.addEventListener('playing',playing);
    const sample=()=>{
      if(!active)return;
      if(player.currentSrc===url&&!player.paused&&!player.ended&&!player.error&&player.currentTime>.01){
        record.advancingSamples++;
        record.maxCurrentTime=Math.max(record.maxCurrentTime,player.currentTime);
        if(document.querySelector('#sound-pulse')?.classList.contains('is-playing'))record.uiPlayingObserved=true;
      }
      frame=requestAnimationFrame(sample);
    };
    window.__curatedHtmlAudioEvidence={record,player,stop(){
      active=false;cancelAnimationFrame(frame);player.removeEventListener('playing',playing);
    }};
    sample();
  },item.url);
  try{
    await page.locator('#sound-play').click();
    // Short looped effects can finish before the coarse range timeupdate.
    // Require both real advancing playback and its visible playing indication.
    await page.waitForFunction(()=>{
      const proof=window.__curatedHtmlAudioEvidence;
      return proof.record.playingEvents>0&&proof.record.advancingSamples>=2&&
        proof.record.maxCurrentTime>.01&&proof.record.uiPlayingObserved&&
        !proof.player.error&&proof.player.loop;
    },undefined,{timeout:15000});
    const record=await page.evaluate(()=>({...window.__curatedHtmlAudioEvidence.record,
      rangeDuration:Number(document.querySelector('#sound-seek').max)}));
    assert.ok(Math.abs(record.rangeDuration-record.duration)<.001,'UI and native audio durations disagree');
    assert.equal(record.url,item.url,'Wrong source played');
    assert.ok(record.maxCurrentTime>.01&&record.advancingSamples>=2&&record.playingEvents>0);
    assert.equal(record.uiPlayingObserved,true,'Playing state was not shown');
    await page.locator('#sound-play').click();
    await page.waitForFunction(()=>window.__curatedHtmlAudioEvidence.player.paused&&
      !document.querySelector('#sound-pulse').classList.contains('is-playing'),undefined,{timeout:15000});
    return {...record,paused:true};
  }finally{
    await page.evaluate(()=>window.__curatedHtmlAudioEvidence?.stop());
  }
}
