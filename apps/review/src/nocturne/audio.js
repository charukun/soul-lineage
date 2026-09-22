import {createNocturneSound as createSharedNocturneSound} from '@soul/johakyu-presentation/audio';

export const BATTLE2_SOUND_SAMPLES=Object.freeze({
  swing:'/library/audio/kenney/sword-swing/368a5d13d3b2cc9d0bf6abe86c5ba950e49aaeb4.ogg',
  guard:'/library/audio/kenney/sword-metal/7c57bffa367f23199029ef8dade2643b58627e98.ogg',
  parry:'/library/audio/kenney/sword-metal/7c57bffa367f23199029ef8dade2643b58627e98.ogg',
  impact:'/library/audio/kenney/impact/3b1508eb218fe8519553483732bd0b3550bf774a.ogg',
  counter:'/library/audio/kenney-impact-additions/impactmetal-heavy-002/4e1053cad3e3aa16694ffefad1789b3343373aa0.ogg',
  footstep:'/library/audio/kenney/footstep-00/7ea335755952eb5570f72d9581d1dfce6536d6b9.ogg',
});

export function createNocturneSound(doc=document){
  const sound=createSharedNocturneSound(doc,{samples:BATTLE2_SOUND_SAMPLES});
  // Keep canonical stamina and the authored fatigue pose, but do not play the
  // looped human panting sample in the battle review.
  return Object.freeze({...sound,fatigue(){}});
}
