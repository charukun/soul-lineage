import {personalSpaceDesiredVelocity} from '@soul/rendering/motion-runtime';
import {NightView} from './web/view.js';

const previous=NightView.prototype.update;
NightView.prototype.update=function updateWithHumanCrowd(game,dt,title=false){
 const result=previous.call(this,game,dt,title),npcs=game?.village?.npcs||[],records=[];
 for(const root of this.actors?.children||[]){const id=root?.userData?.npcId;if(id==null)continue;const npc=npcs.find(row=>String(row.id)===String(id));if(!npc||npc.dead||npc.eaten||!Number.isFinite(npc.x)||!Number.isFinite(npc.z))continue;
  const neighbors=npcs.filter(other=>other!==npc&&!other.dead&&!other.eaten&&Number.isFinite(other.x)&&Number.isFinite(other.z)).map(other=>({x:other.x,z:other.z}));
  const steering=personalSpaceDesiredVelocity({position:{x:npc.x,z:npc.z},preferredVelocity:{x:Number(npc.vx)||0,z:Number(npc.vz)||0},neighbors,radius:.84,maxSuggestion:.18,maxSpeed:4.6});
  root.position.x=npc.x+steering.bias.x;root.position.z=npc.z+steering.bias.z;records.push({id:String(id),bias:steering.bias,desiredVelocity:steering.desiredVelocity,appliedToWorld:false});
 }
 if(typeof window!=='undefined')window.__DEMON_MOTION_CROWD__={snapshot:()=>({version:2,maxSuggestion:.18,worldAuthority:false,navigationConsumerRequired:true,records})};
 return result;
};
