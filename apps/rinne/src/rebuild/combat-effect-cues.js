import {EFFECT_ATTRIBUTE_KEYS} from './authored-effect-manifest.js';
/** Presentation only: never infer a hit from proximity, cooldowns or a pose. */
const finite = Number.isFinite;
const point = (row, height = 1) => row && finite(row.x) && finite(row.z)
  ? {x:row.x, y:finite(row.y)?row.y:height, z:row.z} : null;
const impactPoint=event=>Array.isArray(event?.impact?.point)&&event.impact.point.length>=3&&event.impact.point.every(Number.isFinite)
  ?{x:event.impact.point[0],y:event.impact.point[1],z:event.impact.point[2]}:null;
const attributeEffect=(state,event)=>EFFECT_ATTRIBUTE_KEYS[state?.inspiration?.records?.[event?.techniqueId]?.effectAttribute]||null;

export function combatEffectScope(state, front) {
  return `${state?.id||''}:${state?.zone||''}:${state?.interior?.buildingId||''}:${front?.stage??''}`;
}

export function combatEffectBudget(level = 0, mobile = false, reducedMotion = false) {
  const tier=finite(level)?Math.min(3,Math.max(0,Math.floor(level))):3;
  return Object.freeze({maxActive:reducedMotion?1:(mobile?[4,3,2,1]:[6,4,2,1])[tier],
    maxPerBatch:reducedMotion?1:(tier>=2?2:4), trails:!reducedMotion&&tier<3,
    intensity:reducedMotion ? .55 : 1, instanceMaxCount:512, squareMaxCount:512});
}

export function combatEffectCues(events, {state, front, hostiles=[], anchors={}}={}) {
  if(!Array.isArray(events)||!state||state.phase==='birth'||state.interior)return [];
  const hero=point(state.position), foes=new Map([...(front?.enemies||[]),...hostiles].map(e=>[e.id,e]));
  if(!hero)return [];
  const hitTargets=new Set(events.filter(e=>e?.type==='player-hit'&&finite(e.damage)&&e.damage>0).map(e=>e.targetId));
  const cues=[];
  for(const event of events){
    if(event?.type==='inspiration-start'){
      const origin=point(event.position)|| (event.sourceId===state.id?hero:null);
      if(origin){
        const profile=event.firstInspirationPresentation||{},enemy=point(foes.get(event.targetId));
        const yaw=enemy?Math.atan2(enemy.x-origin.x,enemy.z-origin.z):0;
        cues.push({effect:profile.effect||'finisher',position:{...origin},rotation:{x:0,y:yaw,z:0},
          scale:1.5,lifetime:.8,color:[255,238,176,255],priority:3,kind:'inspiration-world'});
        cues.push({effect:profile.trail||'slash',position:{x:origin.x,y:origin.y+.35,z:origin.z},
          rotation:{x:0,y:yaw,z:0},scale:1.25,lifetime:.4,color:[255,224,148,240],
          priority:2,kind:'inspiration-trail'});
      }
      continue;
    }
    if(!event||!finite(event.damage)||event.damage<=0)continue;
    const manual=event.type==='one-motion'||event.type==='finisher';
    if(manual&&hitTargets.has(event.targetId))continue;
    const outgoing=event.type==='player-hit'||manual;
    if(!outgoing&&event.type!=='enemy-hit')continue;
    const enemy=point(foes.get(outgoing?event.targetId:event.sourceId));
    // Unknown/despawned source is not drawn at the origin or at another actor.
    if(!enemy)continue;
    const from=outgoing?hero:enemy,to=outgoing?enemy:hero,contact=impactPoint(event)||to;
    const heavy=outgoing&&(manual||event.manual===true||event.phase==='one'||event.phase==='kyu'),attribute=outgoing?attributeEffect(state,event):null;
    const rotation={x:0,y:Math.atan2(to.x-from.x,to.z-from.z),z:0};
    const color=attribute?[255,174,92,255]:(outgoing?[255,236,196,255]:[255,126,96,255]);
    // Presentation attributes replace the generic contact burst only; they never change hit authority or damage.
    cues.push({effect:attribute||(heavy?'finisher':'impact'),position:{...contact},rotation,scale:attribute?(heavy?1.08:.92):(heavy?1.15:1),
      lifetime:attribute?(heavy?1.55:1.25):(heavy?1.8:1.2),color,priority:heavy?3:2,kind:attribute?'attribute-contact':(heavy?'finisher':'contact')});
    // The authored ribbon follows the same Tidebreak hand/tip snapshot used by the visible weapon pose when available.
    if(outgoing){const anchor=anchors.hero,cuePosition=anchor?.position||{x:(from.x+to.x)/2,y:from.y,z:(from.z+to.z)/2};cues.push({effect:'slash',position:{...cuePosition},rotation:anchor?.rotation||rotation,scale:heavy?1.35:1,lifetime:.65,color,priority:1,kind:'contact-trail',followKey:anchor?'hero':null});}
  }
  return cues;
}

/** A bounded world-space echo of the local actor's last actual position. */
export function inspirationAfterimageCue(previous,current,profile){
  const a=point(previous),b=point(current);if(!a||!b||!profile?.trail)return null;
  const travel=Math.hypot(b.x-a.x,b.z-a.z);if(travel<.025||travel>1.5)return null;
  return {effect:profile.trail,position:{...a},rotation:{x:0,y:Math.atan2(b.x-a.x,b.z-a.z),z:0},
    scale:.78,lifetime:.24,color:[255,222,154,145],priority:1,kind:'inspiration-afterimage'};
}

/** Drops replayed co-op event batches while retaining different same-tick hits. */
export function createCombatEffectGate(capacity=64) {
  const seen=new Set();let scope=null;
  return {
    enter(nextScope,key){
      const changed=scope!==nextScope;
      if(changed){scope=nextScope;seen.clear();}
      if(key!=null){
        const id=String(key);if(seen.has(id))return {accept:false,changed};
        seen.add(id);if(seen.size>capacity)seen.delete(seen.values().next().value);
      }
      return {accept:true,changed};
    },
    reset(){scope=null;seen.clear();},
    size:()=>seen.size,
  };
}
