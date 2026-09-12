import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createShinoProductionPool,shinoProductionRigFromGLTF} from '@soul/rendering/master-character-production';
import {NightView} from './web/view.js';
import {attachModularAppearanceController} from '@soul/rendering/master-character-modular';
import {createCharacter,visualIdentityForCharacter,YEAR_MS} from '@soul/characters';

export const MASTER_HUMAN_LIMIT=6;
export const SHINO_REVIEW_SHA256='83843ade7dbdfaacc9d601bda099fcb5757527e339b9c5deb223a2c2f5eb28ca';
const MAX_MODEL_BYTES=32*1024*1024;
const AXIS_X=new T.Vector3(1,0,0),AXIS_Y=new T.Vector3(0,1,0),AXIS_Z=new T.Vector3(0,0,1),Q=new T.Quaternion();
const HAIR=[[.14,.1,.08],[.29,.15,.08],[.62,.47,.25],[.18,.17,.25]];
const EYES=[[.35,.2,.1],[.18,.3,.42],[.22,.36,.22],[.4,.24,.36]];
const SKIN=[[1,1,1],[.94,.89,.82],[.84,.73,.64],[.7,.57,.47]];
const ROLE_DYE={knight:[.9,.55,.44],hunter:[.56,.77,.62],smith:[.9,.55,.44],arcanist:[.56,.77,.62],acolyte:[1,1,1],gravekeeper:[.56,.77,.62],bellkeeper:[1,1,1],traveller:[1,1,1]};

const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
export function hashHuman(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let x=Math.imul(s^(s>>>15),1|s);x^=x+Math.imul(x^(x>>>7),61|x);return((x^(x>>>14))>>>0)/4294967296;};}
function pick(random,palette){return[...palette[Math.min(palette.length-1,Math.floor(random()*palette.length))]];}
export function humanAppearance(npc){
 const random=rng(hashHuman(`${npc?.id||'human'}:${npc?.role||'traveller'}`));
 const age=19+random()*39,gray=clamp((age-42)/40,0,1),stoop=.25*clamp((age-55)/35,0,1);
 return{scale:age<22?.98:1,headScale:1,gray,stoop,skinAge:clamp((age-50)/40,0,1),canEquipWeapon:true,
  height:.91+random()*.18,width:.89+random()*.22,adultHeightMetres:2.02,
  hair:pick(random,HAIR),eyes:pick(random,EYES),skin:pick(random,SKIN),dye:[...(ROLE_DYE[npc?.role]||[1,1,1])],dead:false};
}
/** Keep existing NPC age/colour derivation; role is gear, never combat state. */
export function humanVisualIdentity(npc){
 const seed=hashHuman(npc?.id||'human');
 const age=19+rng(hashHuman(`${npc?.id||'human'}:${npc?.role||'traveller'}`))()*39;
 const character=createCharacter({id:`human.${seed.toString(16)}`,seed,ageMs:Math.round(age*YEAR_MS)});
 return visualIdentityForCharacter(character,{role:npc?.role||'traveller'});
}
export function masterHumanScore(npc,player={x:0,z:0}){const distance=Math.hypot((npc?.x||0)-(player?.x||0),(npc?.z||0)-(player?.z||0));const priority=npc?.marked?24:npc?.role==='knight'?10:npc?.role==='hunter'?5:0;return distance-priority;}
export function masterHumanModelUrl(href){return new URL('../rinne/simulator/assets/SHINO_review.vrm',href).href;}

function pose(bones,time,npc){
 bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,-1.2));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,1.2));
 const phase=npc?.pose?.phase??npc?.walk??time*3,walking=(npc?.speed||0)>.05||['flee','pursue'].includes(npc?.state);
 if(walking){const stride=Math.sin(phase)*.42;bones.leftUpperLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,stride));bones.rightUpperLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-stride));bones.leftLowerLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,Math.max(0,-stride)*1.2));bones.rightLowerLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,Math.max(0,stride)*1.2));}
 if(npc?.pose){const p=npc.pose;bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,clamp(p.pitch||0,-.55,.55)));bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_Y,clamp(p.twist||0,-.45,.45)));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.72));bones.rightLowerArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.42));bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.28));}
 if(npc?.state==='flee')bones.head.quaternion.multiply(Q.setFromAxisAngle(AXIS_Y,Math.sin(time*5)*.12));
}
async function digest(bytes){const raw=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function fetchModel(url){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`MasterCharacter HTTP ${response.status}`);const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset too large');const bytes=await response.arrayBuffer();if(bytes.byteLength<28||bytes.byteLength>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset size invalid');if(await digest(bytes)!==SHINO_REVIEW_SHA256)throw new Error('MasterCharacter asset hash mismatch');return bytes;}
function weaponMesh(node,weapon){for(let p=node;p;p=p.parent)if(p===weapon)return true;return false;}
function showProceduralBody(group,visible){if(!group)return;const weapon=group.userData?.weapon;group.traverse(node=>{if(!node.isMesh)return;node.visible=visible||Boolean(weapon&&weaponMesh(node,weapon));});}

const states=new WeakMap();
function stateFor(view){
 if(states.has(view))return states.get(view);
 const state={status:'loading',pool:null,rig:null,entries:new Map(),model:null,error:null};states.set(view,state);
 view.canvas.dataset.masterHuman='loading';view.canvas.dataset.masterHumanLimit=String(MASTER_HUMAN_LIMIT);
 if(typeof window!=='undefined')window.__DEMON_MASTER_HUMANS__={snapshot:()=>({status:state.status,active:state.entries.size,limit:MASTER_HUMAN_LIMIT,model:state.model,error:state.error,ids:[...state.entries.keys()],identities:[...state.entries.values()].map(e=>({id:e.npc.id,...e.modular.diagnostics()}))})};
 void load(view,state);return state;
}
async function load(view,state){try{const url=masterHumanModelUrl(location.href);state.model=url;const bytes=await fetchModel(url);const gltf=await new GLTFLoader().parseAsync(bytes,url);const rig=await shinoProductionRigFromGLTF(gltf);state.rig=rig;state.pool=createShinoProductionPool({template:gltf.scene,humanoid:rig.humanoid,rig,capacity:MASTER_HUMAN_LIMIT});state.status='ready';state.error=null;view.canvas.dataset.masterHuman='ready';}catch(error){state.status='fallback';state.error=String(error?.message||error);view.canvas.dataset.masterHuman='fallback';console.warn('[MasterCharacter humans] fallback',error);}}
function release(view,state,id){const entry=state.entries.get(id);if(!entry)return;showProceduralBody(view.npcs.get(id),true);state.pool?.despawn(entry.poolId);state.entries.delete(id);}
function releaseAll(view,state){for(const id of [...state.entries.keys()])release(view,state,id);}
function acquire(view,state,npc){let entry=state.entries.get(npc.id);if(entry)return entry;if(!state.pool)return null;const poolId=`demon.${hashHuman(npc.id).toString(16)}.${String(npc.id).length}`;const actor=state.pool.spawn(poolId);actor.root.userData.masterCharacter=true;actor.root.userData.npcId=npc.id;view.actors.add(actor.root);const modular=attachModularAppearanceController(actor);modular.setIdentity(humanVisualIdentity(npc));entry={actor,modular,poolId,npc,lastTime:0,role:npc.role,appearance:humanAppearance(npc)};state.entries.set(npc.id,entry);return entry;}
function sync(view,state,game,dt){
 const npcs=game?.village?.npcs||[],player=game?.player||{x:0,z:0};if(state.status!=='ready'){for(const n of npcs)showProceduralBody(view.npcs.get(n.id),true);return;}
 const selected=new Set(npcs.filter(n=>!n.dead&&!n.eaten).sort((a,b)=>masterHumanScore(a,player)-masterHumanScore(b,player)).slice(0,MASTER_HUMAN_LIMIT).map(n=>n.id));
 for(const id of [...state.entries.keys()])if(!selected.has(id))release(view,state,id);
 const time=game.time||view.elapsed||0;
 for(const npc of npcs){const procedural=view.npcs.get(npc.id);if(!selected.has(npc.id)){showProceduralBody(procedural,true);continue;}const entry=acquire(view,state,npc);if(!entry){showProceduralBody(procedural,true);continue;}
  entry.npc=npc;if(entry.role!==npc.role){entry.role=npc.role;entry.appearance=humanAppearance(npc);entry.modular.setIdentity(humanVisualIdentity(npc));}entry.actor.sample(entry.appearance,time,bones=>pose(bones,time,npc));if(entry.actor.expressionNames.includes('blink')){const phase=(time+(hashHuman(npc.id)%13)*.17)%3.2;entry.actor.setExpressions({blink:phase<.16?Math.sin(Math.PI*phase/.16):0});}
  entry.actor.updateSecondary(clamp(dt,0,.1),true);entry.actor.root.position.set(npc.x||0,0,npc.z||0);entry.actor.root.rotation.y=npc.yaw||0;entry.actor.root.visible=!npc.eaten&&!npc.dead;showProceduralBody(procedural,false);
 }
}

const originalBuild=NightView.prototype.build;
NightView.prototype.build=function buildWithMasterHumans(world){const state=stateFor(this);releaseAll(this,state);return originalBuild.call(this,world);};
const originalUpdate=NightView.prototype.update;
NightView.prototype.update=function updateWithMasterHumans(game,dt,title=false){const result=originalUpdate.call(this,game,dt,title);sync(this,stateFor(this),game,dt);return result;};
