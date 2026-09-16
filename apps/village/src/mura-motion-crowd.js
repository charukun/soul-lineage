import {createResidentNeighborhood} from './resident-neighbors.js';
import {personalSpaceDesiredVelocity} from '@soul/rendering/motion-runtime';

function install(){
 const village=window.village;if(!village||window.__MURA_MOTION_CROWD__)return;const{view,world}=village,original=view.syncActor.bind(view),records=new Map(),neighborhood=createResidentNeighborhood(.82);
 view.syncActor=(person,time,monster=false)=>{
  const node=original(person,time,monster);if(!node||monster||person?.species||!Number.isFinite(person?.x)||!Number.isFinite(person?.z))return node;
  const neighbors=neighborhood.query(person,world.people||[],time,world.state.revision);
  const preferred={x:Number(person?.vx)||0,z:Number(person?.vz)||0},steering=personalSpaceDesiredVelocity({position:{x:person.x,z:person.z},preferredVelocity:preferred,neighbors,radius:.82,maxSuggestion:.18,maxSpeed:person?.role==='guard'?4.6:2.8});
  // The simulation remains the navigation authority. This layer previews the same bounded bias on the render node and exposes desiredVelocity for an explicit simulation consumer.
  node.position.x=person.x+steering.bias.x;node.position.z=person.z+steering.bias.z;records.set(String(person.id),{...steering,at:Number(time)||0,appliedToWorld:false});
  return node;
 };
 const originalRemove=view.removeActor.bind(view);view.removeActor=id=>{records.delete(String(id));return originalRemove(id);};
 window.__MURA_MOTION_CROWD__={snapshot:()=>({version:3,neighborhood:neighborhood.snapshot(),active:records.size,maxSuggestion:.18,worldAuthority:false,navigationConsumerRequired:true,records:[...records].map(([id,row])=>({id,bias:row.bias,desiredVelocity:row.desiredVelocity,appliedToWorld:row.appliedToWorld,at:row.at}))})};
}
if(typeof window!=='undefined')install();
