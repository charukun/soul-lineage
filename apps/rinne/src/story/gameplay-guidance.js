const livingEnemies=frame=>(frame.enemies||[]).filter(enemy=>!enemy.dead);

/**
 * Keep the next meaningful play beat visible without changing portable Story rules.
 * Presentation may describe state, but it must not own progression.
 */
export function gameplayGuidance({state,frame,canDepart,nextDeparture}){
  const age=frame.life.ageYears;
  const enemies=livingEnemies(frame);
  if(frame.hero.dead){
    const wait=state.zone==='village'?12:40;
    return {stage:'救助待ち',objective:`救助を待っています。あと${Math.ceil(Math.max(0,wait-state.downedSeconds))}秒`,target:null,tone:'down'};
  }
  if(state.phase==='birth')return {stage:'はじまり',objective:'はじまりの贈り物を、ふたつ選ぼう。',target:null,tone:'calm'};
  if(state.zone==='frontier'){
    if(state.rescue?.status==='carried')return {stage:`前線 ${state.front+1} / 6`,objective:'抱えている村人を帰還船の救護所へ届けよう。',target:null,tone:'urgent'};
    if(state.rescue?.status==='waiting'){
      const suffix=enemies.length?`敵は残り${enemies.length}体。`:'周囲の脅威は退いた。';
      return {stage:`前線 ${state.front+1} / 6`,objective:`倒れた村人を救助しよう。${suffix}`,target:null,tone:enemies.length?'danger':'urgent'};
    }
    if(!state.cleared){
      return {stage:`前線 ${state.front+1} / 6`,objective:enemies.length?`敵は残り${enemies.length}体。接近して戦線を突破しよう。`:'敵の気配を探し、戦線を進もう。',target:null,tone:'danger'};
    }
    if(state.front<5)return {stage:`前線 ${state.front+1} / 6`,objective:'前線突破。次の前線へ進もう。',target:null,tone:'clear'};
    return {stage:'最終前線 突破',objective:'将を退けた。帰還船で村へ戻ろう。',target:null,tone:'clear'};
  }
  if(state.pendingDiscoveries.length)return {stage:'新しい閃き',objective:'暮らしから技を閃いた。受け取って戦い方を広げよう。',target:null,tone:'reward'};
  if(age<7)return {stage:'幼年期',objective:'焚き火へ向かい、村の暮らしに触れよう。',target:'garden',tone:'calm'};
  if(age<15)return {stage:'成長期',objective:`村で経験を重ねよう。旅立ちまであと${Math.max(1,Math.ceil(15-age))}年。`,target:null,tone:'calm'};
  if(canDepart)return {stage:'出航の年',objective:'船着き場へ向かい、前線へ出航しよう。',target:'port',tone:'urgent'};
  return {stage:'村での暮らし',objective:`次の出航は世界暦${nextDeparture}年。暮らしと鍛錬を続けよう。`,target:null,tone:'calm'};
}

export function gameplaySummary({state,frame}){
  if(state.zone==='frontier')return `第${state.generation}生 · 前線 ${state.front+1}/6 · 救助 ${state.rescued}人`;
  return `第${state.generation}生 · 世界暦${Math.floor(frame.life.worldSeconds/60)}年`;
}
