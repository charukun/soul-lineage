// Data boundary only. The simulation owns identity, time, randomness and impacts.
const authorities=new Set(['native-demo','johakyu-review','rinne-domain']);
const phases=new Set(['jo','ha','kyu']);
const text=(value,name)=>{
  if(typeof value!=='string'||!value.length||value.length>200)throw new TypeError(`Invalid ${name}`);
  return value;
};
const finite=(value,name,min=-Infinity)=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<min)throw new TypeError(`Invalid ${name}`);
  return value;
};
const phase=value=>value===null?null:phases.has(value)?value:(()=>{throw new TypeError('Invalid phase');})();
const freeze=Object.freeze;
const bodyParts=['head','torso','leftArm','rightArm','leftLeg','rightLeg'];
function physiology(actor,authority){
  if(authority==='native-demo')return {stamina:null,body:null};
  let stamina=null,body=null;
  if(actor.stamina!=null){const value=finite(actor.stamina.value,'stamina',0),cap=finite(actor.stamina.cap,'stamina cap',1);if(value>100||cap>100)throw new TypeError('Invalid stamina');stamina=freeze({value,cap});}
  if(actor.body!=null)body=freeze(Object.fromEntries(bodyParts.map(part=>{const row=actor.body[part],severity=finite(row?.severity,'body severity',0),durability=finite(row?.durability,'body durability',0);if(severity>1||durability!==Math.round((1-severity)*100))throw new TypeError('Inconsistent body durability');return [part,freeze({severity,durability,stage:text(row.stage,'body stage'),label:text(row.label,'body label')})];})));
  return {stamina,body};
}

/** Copy a simulation-owned frame. No renderer, command, clock or storage ports. */
export function createBattleObservation({authority,battleId,timeSeconds,status,actors,events=[]}){
  if(!authorities.has(authority))throw new TypeError('Invalid authority');
  text(battleId,'battleId');finite(timeSeconds,'timeSeconds',0);text(status,'status');
  if(!Array.isArray(actors)||actors.length>64||!Array.isArray(events)||events.length>128)throw new TypeError('Invalid frame size');
  const ids=new Set();
  const rows=actors.map(actor=>{
    const id=text(actor.id,'actor id');if(ids.has(id))throw new TypeError('Duplicate actor id');ids.add(id);
    if(!['hero','enemy','ally'].includes(actor.side))throw new TypeError('Invalid actor side');
    if(!Array.isArray(actor.position)||actor.position.length!==3)throw new TypeError('Invalid position');
    const position=freeze(actor.position.map(value=>finite(value,'position')));
    const maxHp=finite(actor.maxHp,'maxHp',Number.MIN_VALUE),hp=finite(actor.hp,'hp',0);
    if(hp>maxHp||typeof actor.dead!=='boolean')throw new TypeError('Invalid integrity');
    const executionPhase=phase(actor.phase??null);
    if(authority==='native-demo'&&executionPhase!==null)throw new TypeError('Demo combo is not a canonical phase');
    return freeze({id,side:actor.side,position,hp,maxHp,dead:actor.dead,
      phase:executionPhase,animation:actor.animation===null?null:text(actor.animation,'animation'),
      // Null means not connected. Do not derive game rules from demo HP or clips.
      ...physiology(actor,authority),incapacitated:actor.incapacitated===true,techniqueId:authority==='native-demo'?null:actor.techniqueId==null?null:text(actor.techniqueId,'techniqueId')});
  });
  const eventIds=new Set();
  const impacts=events.map(event=>{
    if(authority==='native-demo'||event.type!=='impact')throw new TypeError('Unsupported semantic event');
    const id=text(event.id,'event id');if(eventIds.has(id))throw new TypeError('Duplicate event id');eventIds.add(id);
    const sourceId=text(event.sourceId,'sourceId'),targetId=text(event.targetId,'targetId');
    if(sourceId===targetId||!ids.has(sourceId)||!ids.has(targetId))throw new TypeError('Unknown impact actor');
    return freeze({id,type:'impact',attackId:text(event.attackId,'attackId'),sourceId,targetId,
      phase:phase(event.phase),techniqueId:event.techniqueId==null?null:text(event.techniqueId,'techniqueId'),damage:finite(event.damage,'damage',0),...(event.bodyPart==null?{}:{bodyPart:bodyParts.includes(event.bodyPart)?event.bodyPart:(()=>{throw new TypeError('Invalid hit body part');})(),bodyDurability:finite(event.bodyDurability,'hit body durability',0)})});
  });
  return freeze({schemaVersion:1,authority,readOnly:true,battleId,
    clock:freeze({owner:authority,seconds:timeSeconds}),status,
    actors:freeze(rows),events:freeze(impacts)});
}
