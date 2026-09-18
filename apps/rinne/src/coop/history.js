import { LIFE_SECONDS, lineageRecord, validateLife } from '../rebuild/domain.js';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(condition,message)=>{if(!condition)throw Error(message);};

/** Structural history rules. Host-attested progress is not proof of honest gameplay. */
export function appendHistory(previous,checkpoint){
  const before=previous?.checkpoint.world,after=checkpoint.world;
  check(after&&Number.isSafeInteger(after.epoch)&&after.epoch>0,'世界の世代が不正です。');
  check(Number.isSafeInteger(after.tick)&&after.tick>=0&&Number.isFinite(after.worldSeconds)&&after.worldSeconds>=0,'世界時計が不正です。');
  check(after.players&&Object.hasOwn(after.players,after.ownerId)&&Object.keys(after.players).length<=30,'村の人数が不正です。');
  const history=structuredClone(previous?.history||[]);
  const append=(type,playerId,life,extra={})=>history.push({sequence:history.length+1,type,playerId,lifeId:life.id,generation:life.generation,worldSeconds:after.worldSeconds,...extra});
  if(before){
    check(before.worldId===after.worldId&&before.ownerId===after.ownerId,'別の村の履歴は上書きできません。');
    check(after.tick>=before.tick&&after.worldSeconds>=before.worldSeconds,'確定した世界時計へ巻き戻せません。');
    for(const id of Object.keys(before.players))check(Object.hasOwn(after.players,id),'記録された人生を削除できません。');
    for(const [id,intent]of Object.entries(before.rebirthOps||{}))check(same(after.rebirthOps?.[id],intent),'確定済みの転生要求を変更できません。');
  }
  for(const [id,row]of Object.entries(after.players)){
    const life=validateLife(row.life),old=before?.players[id]?.life;
    check(Array.isArray(life.lineage)&&typeof life.ended==='boolean'&&life.ended===(life.ageSeconds===LIFE_SECONDS),'人生の終了状態が不正です。');
    check(Number.isSafeInteger(life.generation)&&life.generation>0&&life.id===`${id}:${life.generation}`,'人生の識別情報が不正です。');
    if(!old){
      check(!before||life.generation===1,'出生の世代が不正です。');
      append('born',id,life,{origin:before?'session':'host-checkpoint',lineage:structuredClone(life.lineage)});
      if(life.ended)append('life-ended',id,life,{record:lineageRecord(life)});
      continue;
    }
    if(life.id===old.id){
      check(life.generation===old.generation&&same(life.lineage,old.lineage),'確定した系譜を変更できません。');
      check(life.ageSeconds>=old.ageSeconds&&(!old.ended||life.ended),'確定した人生を巻き戻せません。');
      if(old.ended)check(same(lineageRecord(old),lineageRecord(life)),'終了した人生の記録を変更できません。');
      if(!old.ended&&life.ended){check(life.ageSeconds===LIFE_SECONDS,'寿命に達していません。');append('life-ended',id,life,{record:lineageRecord(life)});}
    }else{
      const op=after.rebirthOps?.[old.id];
      check(old.ended&&life.generation===old.generation+1,'確定前の人生から転生できません。');
      check(op?.playerId===id&&op.lifeId===old.id&&op.resultId===life.id,'転生要求の記録がありません。');
      check(same(life.lineage,[...old.lineage,lineageRecord(old)]),'前世の記録が一致しません。');
      append('reborn',id,life,{previousLifeId:old.id,intent:structuredClone(op)});
    }
  }
  return history;
}

/** The expected life ID also fences delayed requests from an earlier incarnation. */
export function applyRebirthIntent(world,committed,{playerId,lifeId,villageId=null}){
  check(typeof lifeId==='string'&&lifeId.length<=160,'人生の識別情報が不正です。');
  const intent={playerId,lifeId,villageId:villageId||null};
  const prior=world.data.rebirthOps?.[lifeId];
  if(prior){check(same({playerId:prior.playerId,lifeId:prior.lifeId,villageId:prior.villageId},intent),'同じ転生要求の内容を変更できません。');return prior;}
  const life=world.data.players[playerId]?.life,sealed=committed?.world.players[playerId]?.life;
  check(life?.id===lifeId&&life.ended&&sealed?.id===lifeId&&sealed.ended,'人生の確定を待ってから転生してください。');
  check(world.rebirth(playerId,intent.villageId),'転生できません。');
  world.data.rebirthOps??={};
  return world.data.rebirthOps[lifeId]={...intent,resultId:world.data.players[playerId].life.id};
}
