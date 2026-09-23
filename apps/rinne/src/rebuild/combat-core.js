import {ARMORS,skillEffects} from './domain.js';
import {bodyRuntime} from '../combat-loadout.js';
import {readSavedBody,readSavedTerrain} from './johakyu-save-contract.js';
import {tickLifeBattle,sharedEnemyWeapon} from './johakyu-life-battle.js';
export {tidebreakLoadoutFor,tidebreakMindVector,tidebreakMindsetFor,tidebreakWeaponFor} from './tidebreak-loadout.js';
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const TAU=Math.PI*2;

function wrapAngle(value){value=Number(value)||0;while(value>Math.PI)value-=TAU;while(value<-Math.PI)value+=TAU;return value;}
function angleTo(from,to){return Math.atan2(to.x-from.x,to.z-from.z);}
function cleanThreat(raw){const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;for(const [id,value]of Object.entries(raw).slice(0,30))if(typeof id==='string'&&id.length<=120&&finite(value,0,80))out[id]=value;return out;}
function enemyDefaults(id,x,z){return{yaw:angleTo({x,z},{x:0,z:5.2}),attackWindow:0,moving:false,attentionTargetId:null,threat:{},tidebreakPose:null,attacking:false,downed:false,downedElapsed:0};}
export function createFront(stage=0,seed=1){const boss=stage>=5,count=boss?1:3+Math.min(2,stage),rows=[];for(let i=0;i<count;i++){const angle=(i/Math.max(1,count))*Math.PI*1.5+.3,ring=boss?2:2.5+(i%2)*1.2,x=Math.sin(angle)*ring,z=-1.2-Math.cos(angle)*ring;rows.push({id:`front-${stage}-${i}`,x,z,hp:boss?180:42+stage*9,maxHp:boss?180:42+stage*9,dead:false,cooldown:.4+i*.18,flash:0,...enemyDefaults(`front-${stage}-${i}`,x,z)});}return{stage,enemies:rows,cleared:false,clearSeconds:0};}
export function normalizeFront(raw,stage=0,seed=1){
  if(!raw)return createFront(stage,seed);if(!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>5||raw.stage!==stage||!Array.isArray(raw.enemies)||raw.enemies.length<1||raw.enemies.length>6)throw Error('前線の保存データが不正です。');
  const ids=new Set(),enemies=raw.enemies.map(e=>{if(!e||typeof e.id!=='string'||e.id.length>80||ids.has(e.id)||!finite(e.x,-20,20)||!finite(e.z,-20,20)||!finite(e.maxHp,1,1000)||!finite(e.hp,0,e.maxHp)||typeof e.dead!=='boolean'||!finite(e.cooldown,-30,30))throw Error('前線の敵データが不正です。');ids.add(e.id);const fallback=enemyDefaults(e.id,e.x,e.z),attention=typeof e.attentionTargetId==='string'&&e.attentionTargetId.length<=120?e.attentionTargetId:null;return{id:e.id,x:e.x,z:e.z,hp:e.hp,maxHp:e.maxHp,dead:e.dead,cooldown:e.cooldown,flash:finite(e.flash,0,1)?e.flash:0,yaw:Number.isFinite(e.yaw)?wrapAngle(e.yaw):fallback.yaw,attackWindow:finite(e.attackWindow,0,3)?e.attackWindow:0,moving:false,attentionTargetId:attention,threat:cleanThreat(e.threat),tidebreakPose:null,attacking:false,injuries:readSavedBody(e.injuries),downed:e.dead?false:Boolean(e.downed),downedElapsed:finite(e.downedElapsed,0,3600)?e.downedElapsed:0};});
  const allDead=enemies.every(e=>e.dead),allDefeated=enemies.every(e=>e.dead||e.downed);if(raw.cleared===true&&!allDefeated)throw Error('前線の撃破状態が不正です。');const cleared=allDead||(raw.cleared===true&&allDefeated),clearSeconds=finite(raw.clearSeconds,0,3600)?raw.clearSeconds:0;return{stage,enemies,cleared,clearSeconds,...(raw.terrain?{terrain:readSavedTerrain(raw.terrain)}:{})};
}
export function frontierFatalityChance(state){const effects=skillEffects(state),body=bodyRuntime(state),armor=ARMORS[state.equipment.armor]||ARMORS.cloth,shield=state.equipment.shield?.12:0,survival=armor.guard+shield+body.guardBonus+effects.mitigation+effects.evasion*.35+effects.recovery*.2;return clamp(.84-survival*.86,.2,.84);}

export {resolveCapabilityTechniqueChoice} from './johakyu-life-battle.js';
export const enemyWeapon=sharedEnemyWeapon;
export function tickFront(state,front,dt){return tickLifeBattle([state],front,dt,{fatalityChance:frontierFatalityChance}).get(state.id);}
export function tickSharedFront(states,front,dt){return tickLifeBattle(states,front,dt,{fatalityChance:frontierFatalityChance});}
