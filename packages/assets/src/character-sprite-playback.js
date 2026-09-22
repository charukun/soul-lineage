import {assertCharacterSpriteSet,spriteSetLoop} from './character-sprite-set.js';

// Events are presentation notifications, never damage, inventory or movement authority.
export function createSpriteSetPlayback(manifest){
  assertCharacterSpriteSet(manifest);
  let action=null,time=0,frame=0,cycle=0,loop=false,completed=false,paused=false,disposed=false;
  let events=[];
  const alive=()=>{if(disposed)throw new Error('Sprite Set playback is disposed');};
  const emitFrame=(f,c)=>{for(const e of manifest.actions[action].events||[])if(e.frame===f)events.push({type:'frame',action,name:e.name,frame:f,cycle:c});};
  const snapshot=()=>({action,time,frame,cycle,loop,oneShot:!loop,completed,paused,disposed});
  function play(next,options={}){
    alive();
    const variant=options.weapon&&manifest.weaponVariants?.[options.weapon]?.[next];
    next=variant||next;
    if(!Object.hasOwn(manifest.actions,next))throw new Error('Sprite Set action is missing: '+next);
    if(next===action&&options.restart===false)return snapshot();
    if(options.loop!==undefined&&typeof options.loop!=='boolean')throw new Error('Invalid loop override');
    action=next;time=0;frame=0;cycle=0;completed=false;loop=options.loop??spriteSetLoop(manifest.actions[next],next);events=[];
    emitFrame(0,0);return snapshot();
  }
  function step(dt){
    alive();
    if(!Number.isFinite(dt)||dt<0||dt>10)throw new Error('Playback delta must be between 0 and 10 seconds');
    if(paused||completed||!action||dt===0)return snapshot();
    const c=manifest.actions[action],end=c.columns/c.fps,oldTick=Math.floor(time*c.fps+1e-8);
    const nextTime=loop?time+dt:Math.min(end,time+dt),nextTick=Math.floor(nextTime*c.fps+1e-8);
    for(let tick=oldTick+1;tick<=nextTick;tick++){
      if(!loop&&tick>=c.columns)break;
      emitFrame(tick%c.columns,Math.floor(tick/c.columns));
    }
    time=nextTime;cycle=loop?Math.floor(nextTick/c.columns):0;frame=loop?nextTick%c.columns:Math.min(c.columns-1,nextTick);
    if(!loop&&time>=end){completed=true;events.push({type:'complete',action,frame,cycle:0});}
    // Bounded lifetime clock; frame events retain monotonic cycle numbers during a play.
    return snapshot();
  }
  function reset(){alive();events=[];time=0;frame=0;cycle=0;completed=false;if(action)emitFrame(0,0);return snapshot();}
  return {play,step,reset,snapshot,
    pause(value=true){alive();paused=Boolean(value);return snapshot();},
    drainEvents(){const result=events;events=[];return result;},
    dispose(){if(disposed)return;disposed=true;events=[];},
  };
}
