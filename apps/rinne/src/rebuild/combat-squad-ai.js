import { terrainMovementScale } from './combat-world-contact.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.z||0)-(b.z||0));
function hash01(value){const text=String(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;}
function targetFor(enemy,states){return states.find(s=>s.id===enemy.attentionTargetId)||[...states].filter(s=>!s.down&&!s.ended).sort((a,b)=>dist(enemy,a.position)-dist(enemy,b.position))[0]||null;}

export function ensureEnemyLearning(enemy){enemy.combatMemory??={patterns:{},players:{},lastSkill:null,repeat:0,response:'none'};return enemy.combatMemory;}

export function recordEnemyPattern(enemy,playerId,skill){
  const memory=ensureEnemyLearning(enemy),key=String(skill||'unknown'),player=memory.players[playerId]??={patterns:{},last:null,repeat:0};player.patterns[key]=(player.patterns[key]||0)+1;player.repeat=player.last===key?player.repeat+1:1;player.last=key;memory.players[playerId]=player;memory.patterns[key]=(memory.patterns[key]||0)+1;memory.lastSkill=key;memory.repeat=player.repeat;
  if(player.repeat>=4)memory.response='counter';else if(player.repeat>=3)memory.response='evade';else if(player.repeat>=2)memory.response='measure';else memory.response='none';return memory.response;
}

export function enemyLearningResponse(enemy,playerId){const memory=ensureEnemyLearning(enemy),player=memory.players[playerId];if(!player)return{kind:'none',strength:0};const repeat=player.repeat||0,count=player.patterns[player.last]||0,kind=repeat>=4?'counter':repeat>=3?'evade':count>=2?'measure':'none';return{kind,strength:clamp(Math.max(repeat,count)/5,0,1),skill:player.last};}

export function assignSquadRoles(front,states){
  const living=front.enemies.filter(e=>!e.dead).sort((a,b)=>String(a.id).localeCompare(String(b.id))),counts={pressure:0,flankLeft:0,flankRight:0,support:0,retreat:0};
  for(const enemy of living){const hp=enemy.maxHp>0?enemy.hp/enemy.maxHp:0,target=targetFor(enemy,states),response=target?enemyLearningResponse(enemy,target.id):{kind:'none'};let role;
    if(hp<.24)role='retreat';else if(response.kind==='counter'||response.kind==='measure')role='support';else if(counts.pressure===0)role='pressure';else if(counts.flankLeft<=counts.flankRight)role='flankLeft';else if(counts.flankRight===0||counts.flankRight<counts.pressure)role='flankRight';else role=hash01(enemy.id)<.45?'support':'pressure';
    enemy.squadRole=role;counts[role]++;}
  return counts;
}

function desiredFor(enemy,target){const dx=enemy.x-target.position.x,dz=enemy.z-target.position.z,d=Math.max(.001,Math.hypot(dx,dz)),ox=dx/d,oz=dz/d,tx=-oz,tz=ox,role=enemy.squadRole||'pressure',response=enemyLearningResponse(enemy,target.id);let radius=1.45,side=0;
  if(role==='flankLeft'){radius=1.7;side=-1.2;}else if(role==='flankRight'){radius=1.7;side=1.2;}else if(role==='support'){radius=response.kind==='measure'?3.1:2.65;side=(hash01(enemy.id)<.5?-1:1)*.55;}else if(role==='retreat'){radius=3.9;side=(hash01(enemy.id)<.5?-1:1)*.8;}
  if(response.kind==='evade'){radius+=.45;side+=(hash01(`${enemy.id}:learn`)<.5?-1:1)*.85;}if(response.kind==='counter')radius+=.15;
  return{x:target.position.x+ox*radius+tx*side,z:target.position.z+oz*radius+tz*side};
}

export function applySquadTactics(front,states,dt){
  assignSquadRoles(front,states);for(const enemy of front.enemies){if(enemy.dead)continue;const target=targetFor(enemy,states);if(!target)continue;const desired=desiredFor(enemy,target),dx=desired.x-enemy.x,dz=desired.z-enemy.z,len=Math.hypot(dx,dz);if(len<.05)continue;const speed=enemy.squadRole==='retreat'?1.05:enemy.squadRole==='support'?.55:.72,step=Math.min(len,speed*dt),candidate={x:enemy.x+dx/len*step,z:enemy.z+dz/len*step},scale=terrainMovementScale(front,enemy,candidate,.32);enemy.x+=dx/len*step*scale;enemy.z+=dz/len*step*scale;enemy.moving=enemy.moving||step*scale>.002;enemy.squadTargetId=target.id;}
  return front;
}

export function squadSnapshot(front){return front.enemies.filter(e=>!e.dead).map(e=>({id:e.id,role:e.squadRole||'pressure',targetId:e.squadTargetId||e.attentionTargetId||null,response:ensureEnemyLearning(e).response}));}
