import {createSpeechBubbles,suppressLegacySpeechMap} from '@soul/shared-ui/speech-bubbles';

export function installSharedVillageSpeech(village){
  const {world,view,ui,frameHooks}=village||{},layer=document.getElementById('speechLayer');
  if(!world||!view||!ui||!frameHooks||!layer)return()=>{};

  // The original village loop still exists for save-compatible older builds.
  // Make it inert here so both Village and Rinne render dialogue through the
  // same shared runtime without double bubbles during the transition.
  const legacyBubbles=ui.bubbles;
  ui.bubbles=suppressLegacySpeechMap(legacyBubbles);
  const speech=createSpeechBubbles({document,layer,duration:5000,maxVisible:3});
  const hook=()=>{
    const time=performance.now();
    for(const person of world.people){
      if(person.bubble)speech.show({id:person.bubble.id,text:person.bubble.text,personId:person.id});
    }
    speech.sync({time,resolve:item=>{
      const person=world.people.find(row=>row.id===item.personId);if(!person)return null;
      const point=view.headPoint(person),micro=view.span>66;
      return{
        x:point.x,y:point.y-6,micro,
        scale:micro?Math.max(.45,Math.min(.8,65/view.span)):Math.max(.6,Math.min(1,32/view.span)),
        hidden:ui.entryOpen||ui.drawer||!!ui.pending||!!ui.dialogPage||point.x<12||point.x>view.w-12||point.y<60||point.y>view.h-90||!!(person.insideId&&person.insideId!==view.roomId),
      };
    }});
  };
  frameHooks.add(hook);hook();
  return()=>{frameHooks.delete(hook);speech.dispose();ui.bubbles=legacyBubbles;};
}
