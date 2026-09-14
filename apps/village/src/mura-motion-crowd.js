import {personalSpaceNavigationBias} from '@soul/rendering/motion-runtime';

function install(){
 const village=window.village;if(!village||window.__MURA_MOTION_CROWD__)return;const{view,world}=village,original=view.syncActor.bind(view),records=new Map();
 view.syncActor=(person,time,monster=false)=>{
  const node=original(person,time,monster);if(!node||monster||person?.species||!Number.isFinite(person?.x)||!Number.isFinite(person?.z))return node;
  const neighbors=(world.people||[]).filter(other=>other!==person&&!other.hidden&&!other.downed&&Number.isFinite(other.x)&&Number.isFinite(other.z)).map(other=>({x:other.x,z:other.z}));
  const preferred={x:Number(person?.vx)||0,z:Number(person?.vz)||0},bias=personalSpaceNavigationBias({position:{x:person.x,z:person.z},preferredVelocity:preferred,neighbors,radius:.82,maxSuggestion:.18});
  node.position.x=person.x+bias.suggestion.x;node.position.z=person.z+bias.suggestion.z;records.set(String(person.id),{...bias,at:Number(time)||0});
  return node;
 };
 const originalRemove=view.removeActor.bind(view);view.removeActor=id=>{records.delete(String(id));return originalRemove(id);};
 window.__MURA_MOTION_CROWD__={snapshot:()=>({version:1,active:records.size,maxSuggestion:.18,worldAuthority:false,records:[...records].map(([id,row])=>({id,suggestion:row.suggestion,accepted:row.accepted,at:row.at}))})};
}
if(typeof window!=='undefined')install();
