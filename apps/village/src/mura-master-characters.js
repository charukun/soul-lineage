import {THREE as T,GLTFLoader} from '@soul/rendering';
import {createShinoProductionPool,shinoProductionRigFromGLTF} from '@soul/rendering/master-character-production';
import {attachModularAppearanceController} from '@soul/rendering/master-character-modular';
import {createCharacter,visualIdentityForCharacter,YEAR_MS} from '@soul/characters';

export const MASTER_RESIDENT_LIMIT=6;
export const MASTER_RESIDENT_NEAR=42;
export const MASTER_RESIDENT_RELEASE=72;
export const SHINO_REVIEW_SHA256='83843ade7dbdfaacc9d601bda099fcb5757527e339b9c5deb223a2c2f5eb28ca';
const MAX_MODEL_BYTES=32*1024*1024;
const HAIR=[[.14,.1,.08],[.29,.15,.08],[.62,.47,.25],[.18,.17,.25]];
const EYES=[[.35,.2,.1],[.18,.3,.42],[.22,.36,.22],[.4,.24,.36]];
const SKIN=[[1,1,1],[.94,.89,.82],[.84,.73,.64],[.7,.57,.47]];
const DYE=[[1,1,1],[.56,.77,.62],[.9,.55,.44]];
const SIZE_KEYS=[[0,.4],[3,.49],[7,.64],[12,.8],[18,.98],[22,1],[50,1],[65,.985],[80,.955],[90,.935]];
const AXIS_Z=new T.Vector3(0,0,1),AXIS_X=new T.Vector3(1,0,0),Q=new T.Quaternion();

const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const smooth=(lo,hi,x)=>{const t=clamp((x-lo)/(hi-lo),0,1);return t*t*(3-2*t);};
export function hashResident(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let state=seed>>>0;return()=>{state=(state+0x6d2b79f5)>>>0;let x=Math.imul(state^(state>>>15),1|state);x^=x+Math.imul(x^(x>>>7),61|x);return((x^(x>>>14))>>>0)/4294967296;};}
function ageScale(years){let scale=SIZE_KEYS.at(-1)[1];for(let i=1;i<SIZE_KEYS.length;i++)if(years<=SIZE_KEYS[i][0]){const[a,x]=SIZE_KEYS[i-1],[b,y]=SIZE_KEYS[i];scale=x+(y-x)*smooth(a,b,years);break;}return scale;}
function ageYears(p){if(Number.isFinite(p?.ageYears))return clamp(p.ageYears,0,90);const fallback=p?.role==='mayor'?34:p?.role==='guard'?29:18+(hashResident(`${p?.id||'resident'}:age`)%4300)/100;return clamp(fallback,0,90);}
function pick(random,palette){return[...palette[Math.min(palette.length-1,Math.floor(random()*palette.length))]];}

export function residentAppearance(p){
 const years=ageYears(p),random=rng(hashResident(`${p?.id||'resident'}:${Number(p?.seed)||0}`));
 const height=.9+.2*random(),width=.88+.24*random(),hair=pick(random,HAIR),eyes=pick(random,EYES),skin=pick(random,SKIN);
 const dye=[...DYE[p?.role==='mayor'?0:p?.role==='guard'?2:Math.floor(random()*DYE.length)]];
 return{scale:ageScale(years),headScale:1+.22*(1-smooth(0,18,years)),gray:smooth(42,82,years),stoop:.25*smooth(55,90,years),skinAge:smooth(50,90,years),
  canEquipWeapon:years>=7,height,width,adultHeightMetres:1.72,hair,eyes,skin,dye,dead:Boolean(p?.dead)};
}
/** Presentation-only record; never written into the authoritative resident/save. */
export function residentVisualIdentity(person,workplace=''){
 const seed=hashResident(`${person?.id||'resident'}:${Number(person?.seed)||0}`);
 const character=createCharacter({id:`resident.${hashResident(person?.id).toString(16)}`,seed,ageMs:Math.round(ageYears(person)*YEAR_MS)});
 return visualIdentityForCharacter(character,{role:person?.role||'resident',workplace});
}
export function residentMasterScore(p,target={x:0,z:0}){const dx=(Number(p?.x)||0)-(Number(target?.x)||0),dz=(Number(p?.z)||0)-(Number(target?.z)||0),distance=Math.hypot(dx,dz);const priority=p?.role==='mayor'?120:p?.role==='guard'?18:0;return distance-priority;}
export function masterModelUrl(href){return new URL('../rinne/simulator/assets/SHINO_review.vrm',href).href;}

function pose(bones,time,p){
 bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,-1.22));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_Z,1.22));
 bones.leftLowerArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.12));bones.rightLowerArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.12));
 if(p.moving){const stride=Math.sin(time*4.2+(Number(p.seed)||0))*.38;bones.leftUpperLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,stride));bones.rightUpperLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-stride));bones.leftLowerLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,Math.max(0,-stride)*1.25));bones.rightLowerLeg.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,Math.max(0,stride)*1.25));}
 if(p.task==='work'){bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,.12+Math.sin(time*3)*.05));bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.28));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.28));}
 if(p.task==='defending'){bones.spine.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.04));bones.leftUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.2));bones.rightUpperArm.quaternion.multiply(Q.setFromAxisAngle(AXIS_X,-.35));}
}
async function sha256(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function modelBytes(url){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`MasterCharacter HTTP ${response.status}`);const declared=Number(response.headers.get('content-length'));if(Number.isFinite(declared)&&declared>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset too large');const bytes=await response.arrayBuffer();if(bytes.byteLength<28||bytes.byteLength>MAX_MODEL_BYTES)throw new Error('MasterCharacter asset size invalid');if(await sha256(bytes)!==SHINO_REVIEW_SHA256)throw new Error('MasterCharacter asset hash mismatch');return bytes;}

function install(){
 const village=window.village;if(!village||window.__MURA_MASTER_CHARACTERS__)return;const{view}=village,originalSync=view.syncActor.bind(view),originalRemove=view.removeActor.bind(view);
 const state={version:1,state:'loading',limit:MASTER_RESIDENT_LIMIT,active:0,model:null,error:null};const entries=new Map();let pool=null;
 view.canvas.dataset.masterCharacter='loading';view.canvas.dataset.masterCharacterLimit=String(MASTER_RESIDENT_LIMIT);
 const snapshot=()=>({...state,active:entries.size,ids:[...entries.keys()],identities:[...entries.values()].map(e=>({id:e.person.id,...e.modular.diagnostics()}))});window.__MURA_MASTER_CHARACTERS__={snapshot};
 function release(id){const entry=entries.get(id);if(!entry)return false;if(view.actorNodes.get(id)===entry.actor.root)view.actorNodes.delete(id);pool?.despawn(entry.poolId);entries.delete(id);state.active=entries.size;return true;}
 function eligible(p,monster){return Boolean(pool&&!monster&&!p?.species&&!p?.hidden&&!p?.downed&&!p?.carry);}
 function threshold(p){return p?.role==='mayor'?MASTER_RESIDENT_RELEASE:Math.max(MASTER_RESIDENT_NEAR,Math.min(58,(view.span||40)*1.3));}
 function acquire(p,time){
  let entry=entries.get(p.id);if(entry)return entry;const score=residentMasterScore(p,view.target);if(score>threshold(p))return null;
  if(entries.size>=MASTER_RESIDENT_LIMIT){let worst=null;for(const candidate of entries.values()){const value=residentMasterScore(candidate.person,view.target);if(!worst||value>worst.score)worst={entry:candidate,score:value};}if(!worst||score>=worst.score-2)return null;release(worst.entry.person.id);}
  const poolId=`village.${hashResident(p.id).toString(16)}.${String(p.id).length}`;const actor=pool.spawn(poolId);actor.root.userData.masterCharacter=true;actor.root.userData.personId=p.id;actor.root.userData.signature=`master:${p.role||'resident'}`;view.actors.add(actor.root);entry={actor,modular:attachModularAppearanceController(actor),poolId,person:p,lastTime:time,appearanceKey:''};entries.set(p.id,entry);state.active=entries.size;return entry;
 }
 function syncMaster(p,time,monster){
  if(!eligible(p,monster)){release(p?.id);return null;}const score=residentMasterScore(p,view.target);if(score>MASTER_RESIDENT_RELEASE&&p.role!=='mayor'){release(p.id);return null;}const entry=acquire(p,time);if(!entry)return null;entry.person=p;
  const workplace=village.world?.object?.(p.jobId)?.kind||'',years=ageYears(p),key=`${Math.floor(years*12)}:${p.role||'resident'}:${workplace}:${Number(p.seed)||0}:${Boolean(p.dead)}`;if(entry.appearanceKey!==key){entry.appearance=residentAppearance(p);entry.modular.setIdentity(residentVisualIdentity(p,workplace));entry.appearanceKey=key;entry.actor.resetSecondary();}
  entry.actor.sample(entry.appearance,time,bones=>pose(bones,time,p));
  if(entry.actor.expressionNames.includes('blink')){const phase=(time+(hashResident(p.id)%17)*.13)%3.4;entry.actor.setExpressions({blink:phase<.18?Math.sin(Math.PI*phase/.18):0});}
  const dt=clamp(time-entry.lastTime,0,.1);entry.lastTime=time;entry.actor.updateSecondary(dt,true);entry.actor.root.position.set(p.x||0,0,p.z||0);entry.actor.root.rotation.y=p.angle||0;entry.actor.root.visible=!p.hidden;entry.actor.root.userData.personId=p.id;return entry.actor.root;
 }
 view.syncActor=(p,time,monster=false)=>{const node=syncMaster(p,time,monster);if(!node)return originalSync(p,time,monster);const current=view.actorNodes.get(p.id);if(current&&current!==node)view.actors.remove(current);if(node.parent!==view.actors)view.actors.add(node);view.actorNodes.set(p.id,node);return node;};
 view.removeActor=id=>{release(id);return originalRemove(id);};
 async function load(){try{const url=masterModelUrl(location.href);state.model=url;const bytes=await modelBytes(url);const gltf=await new GLTFLoader().parseAsync(bytes,url);const rig=await shinoProductionRigFromGLTF(gltf);pool=createShinoProductionPool({template:gltf.scene,humanoid:rig.humanoid,rig,capacity:MASTER_RESIDENT_LIMIT});state.state='ready';state.error=null;view.canvas.dataset.masterCharacter='ready';}catch(error){state.state='fallback';state.error=String(error?.message||error);view.canvas.dataset.masterCharacter='fallback';console.warn('MasterCharacter residents fallback:',error);}}
 setTimeout(()=>void load(),250);
}

function installWhenVillageReady(tries=0){if(typeof window==='undefined')return;if(window.village){install();return;}if(tries<200)setTimeout(()=>installWhenVillageReady(tries+1),50);}
if(typeof window!=='undefined')installWhenVillageReady();
