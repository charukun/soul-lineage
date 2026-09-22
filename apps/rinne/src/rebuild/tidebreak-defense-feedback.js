/** Project only native contact-journal defenses. A pose or evaded toast is not evidence. */
export function readTidebreakDefenseFeedback(session,next,{openContact=true,enemyCanHit=true,paid=true}={}){
  if(!openContact||!enemyCanHit)return [];
  const heroId=String(next.hero.id),enemyId=String(next.enemy.id);
  const id=value=>String(value)===heroId?session.sourceId:String(value)===enemyId?session.targetId:null;
  return (next.exchangeEvents||[]).filter(row=>['parry','guard'].includes(row.type)&&row.attackId!=null&&id(row.sourceId)&&id(row.targetId)&&(String(row.sourceId)!==heroId||paid)).map(row=>({
    type:row.type,sourceId:id(row.sourceId),targetId:id(row.targetId),attackId:`${session.id}:${row.attackId}`,
    phase:row.phase,damage:0,blocked:true,strongParry:row.type==='parry'&&row.strong===true,
    parryStrength:row.strong===true?'strong':'weak',exchangeContinuity:row.exchange?.continuity??null,
    impact:(next.impacts||[]).find(impact=>impact.attackId===row.attackId&&String(impact.sourceId)===String(row.sourceId)&&String(impact.targetId)===String(row.targetId))??null,engine:'tidebreak'
  }));
}
