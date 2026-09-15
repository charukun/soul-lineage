import {PREY,FORMS} from '@soul/raid/world';

const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
export const FEAST_SECONDS=2.4;
export const BITE_BEATS=Object.freeze([.51,.68]);

/** Presentation envelopes only: never advance capture, health or combat clocks. */
export function feastEnvelope(progress,age=Infinity,{reducedMotion=false}={}){
 const feeding=Number.isFinite(progress),p=feeding?clamp(progress):0;
 const release=Number.isFinite(age)&&age>=0&&age<FEAST_SECONDS;
 const bloom=release?ease(age/.10)*(1-ease((age-.24)/1.65)):0;
 const bite=feeding?Math.max(...BITE_BEATS.map(at=>Math.max(0,1-Math.abs(p-at)/.055))):0;
 return {feeding,release,charge:feeding?ease(p/.32)*(1-ease((p-.85)/.15)):0,
  bite,bloom,body:release?ease(age/.12)*(1-ease((age-.18)/.68)):0,
  wave:release?ease(age/1.25):0,
  camera:reducedMotion?0:(feeding?ease(p/.35)*.12*(1-ease((p-.85)/.15)):bloom*.055)};
}

/** Facts come from the single successful consume event, including auto-equipped HP. */
export function feastReward(event){
 const r=event.reward;if(!r)return null;
 const power=PREY[event.role];
 const unlockedForm=Object.values(FORMS).find(f=>f.need>r.unlockedBefore&&f.need<=r.unlockedCount);
 const next=Object.values(FORMS).find(f=>f.need>r.unlockedCount);
 const vitality=r.healed>0?`生命 +${Math.round(r.healed)}`:'生命は満ちている';
 return {kind:unlockedForm?'form':r.memoryNew?'memory':'restore',
  title:unlockedForm?`${unlockedForm.name} 解放`:r.memoryNew?power.power:'命を、喰らった。',
  detail:[vitality,r.maxHpGain>0?`最大生命 +${r.maxHpGain}`:'',
   r.memoryNew?`${unlockedForm?power.power:r.equipped?'新たな力':'新たな記憶'} · ${r.equipped?'装着済み':'肉体で装着'}`:'',
   unlockedForm?'肉体で姿を選べる':''].filter(Boolean).join(' / '),
  progress:next?`${next.name}まで、未知の記憶あと${next.need-r.unlockedCount}種`:`記憶 ${r.unlockedCount} / ${Object.keys(PREY).length}`,
  fromCount:r.unlockedBefore,count:r.unlockedCount,goal:next?.need||Object.keys(PREY).length,
  color:unlockedForm?0xffd18a:r.memoryNew?0x9effcd:0x98d5c7};
}

/** A scent direction, not a pathfinder: sealed sanctuaries and consumed prey are excluded. */
export function nextPrey(game,{returning=false,revealed=false}={}){
 if(!game||game.finished||game.fight||game.devour||returning||game.escapeHold>0)return null;
 const profile=game.profile,p=game.player,shelter=game.village.shelter;
 const candidates=game.village.npcs.filter(n=>!n.eaten&&PREY[n.role]).map(n=>({npc:n,distance:Math.hypot(n.x-p.x,n.z-p.z),fresh:!profile.unlocked.includes(n.role)})).filter(c=>{
  const n=c.npc,sealed=shelter&&!profile.equipped.includes('acolyte')&&Math.hypot(n.x-shelter.x,n.z-shelter.z)<shelter.r;
  return !sealed&&(revealed||game.scent>0||profile.equipped.includes('hunter')||c.distance<7||n.marked&&c.distance<15);
 });
 candidates.sort((a,b)=>Number(b.fresh)-Number(a.fresh)||Number(b.npc.dead)-Number(a.npc.dead)||a.distance-b.distance||a.npc.id.localeCompare(b.npc.id));
 return candidates[0]||null;
}

// The camera keeps the same .33 heading during the brief capture dolly.
export function scentBearing(player,prey,heading=.33){
 const dx=prey.x-player.x,dz=prey.z-player.z;
 return Math.atan2(dx*Math.cos(heading)-dz*Math.sin(heading),-(dx*Math.sin(heading)+dz*Math.cos(heading)));
}
