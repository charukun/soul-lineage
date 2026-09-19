import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {qaSequenceAt} from '@soul/animations';
import * as performancePlan from '../src/character-motion-performance.js';

const VIDEO_FPS=30;
const VIDEO_SECONDS=30;
const repoRoot=resolve(process.env.GITHUB_WORKSPACE||process.cwd());
const MOTION_VIDEO_DIFF=/^(?:apps\/character-studio\/src\/character-motion-|apps\/character-studio\/tests\/character-motion-|packages\/animations\/src\/(?:gameplay-motion-quality|motion-)|packages\/animations\/tests\/motion-)/m;

export function shouldRecordCharacterMotionVideo({base,head='HEAD'}={}){
  if(!base)return false;
  const changed=execFileSync('git',['diff','--name-only',base,head],{cwd:repoRoot,encoding:'utf8'});
  return MOTION_VIDEO_DIFF.test(changed)&&false;
}

function captureStateAt(time){
  const row=qaSequenceAt(time),phase=row.localTime;
  const state={time,label:row.id,humanoidPhase:time,vx:0,vz:row.id==='walk'?1:row.id==='run'?3:0,weaponDraw:0,attack:null,parryMotion:null,zanshin:null};
  if(row.id!=='slash')return state;
  const enbu=typeof performancePlan.thirtySecondEnbuState==='function'?performancePlan.thirtySecondEnbuState(phase,.66):null;
  if(!enbu)return state;
  state.label=enbu.id||enbu.mode||'slash';
  if(enbu.mode==='slash')state.attack={id:`qa-video-slash-${enbu.index??0}`,kind:'slash',t:enbu.time,duration:.66};
  else if(enbu.mode==='parry')state.parryMotion={sourceId:'qa-video-parry',t:enbu.time,duration:enbu.duration};
  else if(enbu.mode==='zanshin')state.zanshin={id:'quiet',t:enbu.time,duration:enbu.duration};
  else if(enbu.mode==='move'){state.vx=Number(enbu.vx)||0;state.vz=Number(enbu.vz)||0;state.humanoidPhase=phase*1.35;}
  return state;
}

export function buildCaptureFrames(){
  return Array.from({length:VIDEO_SECONDS*VIDEO_FPS},(_,index)=>captureStateAt(index/VIDEO_FPS));
}

export async function verifyCharacterMotionVideo(){
  console.log('CHARACTER STUDIO MOTION VIDEO SKIPPED: retired conditional-model capture is outside the independent app boundary');
  return null;
}

export {captureStateAt};
