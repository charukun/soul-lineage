import {unlocked as sharedUnlocked} from '@soul/world/mura/catalog';

// The founding guide asks for the 木工所 before the first logging tick can
// guarantee that 丸太 has been discovered, so keep that guided choice visible.
export * from '@soul/world/mura/catalog';
export function unlocked(state,kind,room=false){
  const foundingGuide=state?.onboarding?.firstRunAutoplay;
  if(!room&&kind==='carpenter'&&foundingGuide?.version>=5&&!foundingGuide.seen)return true;
  return sharedUnlocked(state,kind,room);
}
