import {explicitInteractionAdapter} from '@soul/rendering/motion-runtime';
import {NightView} from './web/view.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const angleDelta=(from,to)=>{let d=(to-from)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
const snapshots=new WeakMap();

function masterRoot(view,id){return view?.actors?.children?.find(node=>node?.userData?.masterCharacter&&String(node.userData.npcId)===String(id))??null;}
function applyDevourInteraction(view,game){
 const rows=[];for(const npc of game?.village?.npcs??[]){const captured=npc?.capturedBy;if(!captured||npc.eaten)continue;const root=masterRoot(view,npc.id);if(!root)continue;
  let interaction;try{interaction=explicitInteractionAdapter('eat-target',{partner:{id:'demon-player'},anchors:{self:{x:Number(npc.x)||0,y:1.08,z:Number(npc.z)||0},partner:{x:Number(captured.x)||0,y:1.12,z:Number(captured.z)||0}},metadata:{progress:clamp(Number(captured.progress)||0),source:'raid.devour.capturedBy'}});}catch{continue;}
  const progress=clamp(Number(captured.progress)||0),dx=(Number(captured.x)||0)-(Number(npc.x)||0),dz=(Number(captured.z)||0)-(Number(npc.z)||0),distance=Math.hypot(dx,dz),pull=Math.min(.12,Math.max(0,distance-.40))*(.25+.75*progress),nx=distance>1e-6?dx/distance:0,nz=distance>1e-6?dz/distance:0,targetYaw=distance>1e-6?Math.atan2(dx,dz):root.rotation.y,yawDelta=clamp(angleDelta(root.rotation.y,targetYaw),-.8,.8)*(.35+.65*progress);
  root.position.x=(Number(npc.x)||0)+nx*pull;root.position.z=(Number(npc.z)||0)+nz*pull;root.rotation.y=(Number(npc.yaw)||0)+yawDelta;root.visible=true;root.userData.motionInteraction='eat-target';
  rows.push({npcId:npc.id,schema:interaction.schema.id,partnerId:interaction.partnerId,progress,pull,yawDelta,presentationOnly:true,worldAuthority:false});
 }
 snapshots.set(view,rows);return rows;
}

const originalUpdate=NightView.prototype.update;
NightView.prototype.update=function updateWithMotionInteractions(game,dt,title=false){const result=originalUpdate.call(this,game,dt,title);applyDevourInteraction(this,game);return result;};
if(typeof window!=='undefined')window.__DEMON_MOTION_INTERACTIONS__={snapshot:()=>{const view=window.__NIGHT_HUNT_VIEW__;return view?snapshots.get(view)??[]:[];}};
export {applyDevourInteraction};
