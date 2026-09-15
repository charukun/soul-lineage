export function huntUiState(game,{returning=false}={}){
 const fight=!!game?.fight,devour=!!game?.devour,finished=!!game?.finished,busy=fight||devour;
 const eaten=Math.max(0,Number(game?.eaten)||0),canReturn=eaten>0&&!finished;
 const scentCooldown=Math.max(0,Number(game?.scentCooldown)||0);
 return{
  busy,fight,devour,finished,canReturn,
  scentDisabled:busy||finished||scentCooldown>0,
  memoryDisabled:busy||finished,
  returnDisabled:busy||finished,
  returnLocked:!canReturn,
  showReturnHint:canReturn&&(returning||!!game?.targetEaten||(Number(game?.escapeHold)||0)>0)&&!fight,
 };
}
