const livingEnemies=frame=>(frame.enemies||[]).filter(enemy=>!enemy.dead);

/**
 * Presentation-only guidance. Portable Story / Journey remain authoritative for progression.
 * This deliberately preserves the newer Journey loop while restoring the missing quality pass.
 */
export function gameplayGuidance({state,frame,canDepart,nextDeparture,practice=null,learnedCount=0,equipped=false}){
  const age=frame.life.ageYears,enemies=livingEnemies(frame);
  if(frame.hero.dead){
    const wait=state.zone==='village'?12:40;
    return {stage:'救助待ち',objective:`救助を待っています。あと${Math.ceil(Math.max(0,wait-state.downedSeconds))}秒`,target:null,tone:'down'};
  }
  if(state.phase==='birth')return {stage:'はじまり',objective:'はじまりの贈り物を、ふたつ選ぼう。',target:null,tone:'calm'};
  if(state.zone==='frontier'){
    if(state.rescue?.status==='carried')return {stage:`前線 ${state.front+1} / 6`,objective:'抱えている村人を帰還船の救護所へ届けよう。',target:'return',tone:'urgent'};
    if(state.rescue?.status==='waiting'){
      const suffix=enemies.length?`敵は残り${enemies.length}体。`:'周囲の脅威は退いた。';
      return {stage:`前線 ${state.front+1} / 6`,objective:`倒れた村人を救助しよう。${suffix}`,target:'rescue',tone:enemies.length?'danger':'urgent'};
    }
    if(!state.cleared)return {stage:`前線 ${state.front+1} / 6`,objective:enemies.length?`敵は残り${enemies.length}体。接近して戦おう。`:'敵の気配を探し、戦線を進もう。',target:null,tone:'danger'};
    return {stage:state.front===5?'最終前線 突破':`前線 ${state.front+1} / 6`,objective:'前線を突破。帰還して次の旅支度へ。',target:'return',tone:'clear'};
  }
  if(state.pendingDiscoveries.length)return {stage:'新しい閃き',objective:'技を閃いた！ タップして受け取り・装備へ。',target:null,tone:'reward'};
  if(learnedCount&&!equipped)return {stage:'旅支度',objective:'覚えた技を装備しよう。タップして支度へ。',target:null,tone:'urgent'};
  if(!learnedCount&&practice)return {stage:'暮らし',objective:`${practice.label}を重ねて「${practice.discoveryName}」を覚えよう。`,target:practice.placeId||null,tone:'calm'};
  if(canDepart)return {stage:'出航の年',objective:'旅支度を確認して、船着き場へ。',target:'port',tone:'urgent'};
  if(age<7)return {stage:'幼年期',objective:'焚き火へ向かい、村の暮らしに触れよう。',target:'garden',tone:'calm'};
  return {stage:'村での暮らし',objective:`次の出航は世界暦${nextDeparture}年。暮らしと支度を開く。`,target:null,tone:'calm'};
}

export function gameplaySummary({state,frame}){
  if(state.zone==='frontier')return `第${state.generation}生 · 前線 ${state.front+1}/6 · 救助 ${state.rescued}人`;
  return `第${state.generation}生 · 世界暦${Math.floor(frame.life.worldSeconds/60)}年`;
}
