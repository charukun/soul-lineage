import {execFileSync} from 'node:child_process';
import {mkdirSync,statSync,writeFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';
import {qaSequenceAt} from '@soul/animations';
import {SLASH_REVISION,SLASH_SECONDS} from '../public/simulator/src/authored-slash.js';
import * as performancePlan from '../src/character-motion-performance.js';

const VIDEO_FPS=30;
const VIDEO_SECONDS=30;
const repoRoot=resolve(process.env.GITHUB_WORKSPACE||process.cwd());
const MOTION_VIDEO_DIFF=/^(?:apps\/rinne\/src\/character-motion-|apps\/rinne\/tests\/character-motion-|apps\/rinne\/public\/simulator\/(?:motion-capture\.html|src\/(?:authored-slash|humanoid|motion-))|packages\/animations\/src\/(?:gameplay-motion-quality|motion-)|packages\/animations\/tests\/motion-)/m;

export function shouldRecordCharacterMotionVideo({base,head='HEAD'}={}){
  if(!base)return true;
  const changed=execFileSync('git',['diff','--name-only',base,head],{cwd:repoRoot,encoding:'utf8'});
  return MOTION_VIDEO_DIFF.test(changed);
}

function currentEnbuState(localTime){
  if(typeof performancePlan.thirtySecondEnbuState==='function'){
    return performancePlan.thirtySecondEnbuState(localTime,SLASH_SECONDS);
  }
  if(typeof performancePlan.thirtySecondSlashBeat==='function'){
    const beat=performancePlan.thirtySecondSlashBeat(localTime,SLASH_SECONDS);
    return beat?{id:`cut-${beat.index+1}`,mode:'slash',index:beat.index,start:beat.start,time:beat.time,duration:SLASH_SECONDS}:null;
  }
  throw new Error('30-second motion performance resolver is unavailable');
}

function captureStateAt(time){
  const row=qaSequenceAt(time),phase=row.localTime;
  const state={
    time,
    label:row.id,
    humanoidPhase:time,
    vx:0,
    vz:row.id==='walk'?1:row.id==='run'?3:0,
    combatReady:['draw','guard','slash','sheathe'].includes(row.id),
    weaponTransition:['draw','sheathe'].includes(row.id),
    weaponDraw:['guard','slash'].includes(row.id)?1:row.id==='draw'?row.progress:row.id==='sheathe'?1-row.progress:0,
    attack:null,
    parryMotion:null,
    zanshin:null,
  };
  if(row.id!=='slash')return state;
  const enbu=currentEnbuState(phase);
  if(!enbu)return state;
  state.label=enbu.id||enbu.mode||'slash';
  if(enbu.mode==='slash')state.attack={id:`qa-video-slash-${enbu.index??0}`,kind:'slash',t:enbu.time,duration:SLASH_SECONDS};
  else if(enbu.mode==='parry')state.parryMotion={sourceId:'qa-video-parry',t:enbu.time,duration:enbu.duration};
  else if(enbu.mode==='zanshin')state.zanshin={id:'quiet',t:enbu.time,duration:enbu.duration};
  else if(enbu.mode==='move'){
    state.vx=Number(enbu.vx)||0;
    state.vz=Number(enbu.vz)||0;
    state.humanoidPhase=phase*1.35;
  }
  return state;
}

function buildCaptureFrames(){
  return Array.from({length:VIDEO_SECONDS*VIDEO_FPS},(_,index)=>captureStateAt(index/VIDEO_FPS));
}

function tryCreateMp4(webmPath,mp4Path){
  try{
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',webmPath,'-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',mp4Path],{stdio:'pipe'});
    return statSync(mp4Path).size>0?mp4Path:null;
  }catch{return null;}
}

export async function verifyCharacterMotionVideo(browser,baseURL,output,{head='unknown',pr=null}={}){
  const exactHead=process.env.HEAD_SHA||head||'HEAD';
  if(!shouldRecordCharacterMotionVideo({base:process.env.BASE_SHA,head:exactHead})){
    console.log('SHINO MOTION VIDEO SKIPPED: no motion-affecting diff');
    return null;
  }
  const motionDir=resolve(output,'motion-preview');
  mkdirSync(motionDir,{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[],failedRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()?.errorText||'failed'}));
  const route=new URL('./simulator/motion-capture.html',baseURL).href;
  const frames=buildCaptureFrames();
  const source=typeof performancePlan.thirtySecondEnbuState==='function'?'thirtySecondEnbuState':'thirtySecondSlashBeat';
  const shortHead=String(exactHead).slice(0,12),webmPath=resolve(motionDir,`rinne-shino-30s-${shortHead}.webm`),mp4Path=resolve(motionDir,`rinne-shino-30s-${shortHead}.mp4`);
  let capture=null,videoPath=webmPath;
  try{
    const response=await page.goto(route,{waitUntil:'domcontentloaded',timeout:30000});
    if(!response?.ok())throw new Error(`Shino motion capture returned HTTP ${response?.status()}`);
    await page.waitForFunction(()=>window.__RINNE_MOTION_CAPTURE__?.ready===true,null,{timeout:120000});
    const runtimeMeta=await page.evaluate(()=>window.__RINNE_MOTION_CAPTURE__.snapshot());
    if(runtimeMeta.model!=='SHINO')throw new Error(`Motion capture loaded unexpected model ${runtimeMeta.model}`);
    if(runtimeMeta.revision!==SLASH_REVISION)throw new Error(`Motion capture revision ${runtimeMeta.revision} != ${SLASH_REVISION}`);
    const keyFrame=frames[Math.floor(17.5*VIDEO_FPS)];
    await page.evaluate(state=>window.__RINNE_MOTION_CAPTURE__.render(state),keyFrame);
    await page.locator('#motion-capture-stage').screenshot({path:resolve(motionDir,`rinne-shino-keyframe-${shortHead}.png`)});
    const downloadPromise=page.waitForEvent('download',{timeout:90000});
    const capturePromise=page.evaluate(payload=>window.__RINNE_MOTION_CAPTURE__.capture(payload),{
      frames,fps:VIDEO_FPS,duration:VIDEO_SECONDS,fileName:`rinne-shino-30s-${shortHead}.webm`,
    });
    const download=await downloadPromise;
    capture=await capturePromise;
    await download.saveAs(webmPath);
    if(statSync(webmPath).size<=0)throw new Error('Shino motion WebM is empty');
    const mp4=tryCreateMp4(webmPath,mp4Path);
    if(mp4)videoPath=mp4;
    if(errors.length||failedRequests.length)throw new Error(`Shino motion capture browser errors: ${JSON.stringify({errors,failedRequests})}`);
    const receipt={
      schema:1,
      kind:'rinne-shino-motion-video',
      exactHead,
      pr,
      model:'SHINO',
      modelName:'Sendagaya_Shino',
      motionRevision:SLASH_REVISION,
      source,
      route,
      renderer:'webgl',
      playbackSpeed:1,
      range:[0,VIDEO_SECONDS],
      fps:VIDEO_FPS,
      frameCount:frames.length,
      recordedMime:capture.mimeType,
      recordedBytes:capture.bytes,
      webm:basename(webmPath),
      mp4:videoPath===mp4Path?basename(mp4Path):null,
      preferredVideo:basename(videoPath),
      visualApproval:'not-assessed',
      errors,
      failedRequests,
    };
    writeFileSync(resolve(motionDir,'motion-video-receipt.json'),JSON.stringify(receipt,null,2));
    console.log('SHINO MOTION VIDEO CAPTURED',JSON.stringify({head:exactHead,revision:SLASH_REVISION,video:receipt.preferredVideo,bytes:statSync(videoPath).size}));
    return receipt;
  }catch(error){
    await page.screenshot({path:resolve(motionDir,`rinne-shino-capture-failure-${shortHead}.png`),fullPage:true}).catch(()=>{});
    writeFileSync(resolve(motionDir,'motion-video-receipt.json'),JSON.stringify({schema:1,kind:'rinne-shino-motion-video',exactHead,pr,success:false,error:String(error),errors,failedRequests},null,2));
    throw error;
  }finally{
    await context.close();
  }
}

export {buildCaptureFrames,captureStateAt};
