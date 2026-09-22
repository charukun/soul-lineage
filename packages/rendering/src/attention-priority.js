const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));

/**
 * Asset-loading priority from the player's current point of attention.
 * This is intentionally presentation-only: it must never decide gameplay authority.
 */
export function attentionLoadPriority({
  selected=false,
  combat=false,
  interactive=false,
  visible=true,
  screenAlignment=0,
  screenCoverage=0,
  distance=Infinity
}={}){
  if(selected)return 260;
  let score=combat?210:interactive?150:visible?24:4;
  score+=Math.round(clamp01(screenAlignment)*92);
  score+=Math.round(clamp01(screenCoverage)*58);
  if(Number.isFinite(distance))score+=Math.round(52*(1-clamp01(distance/80)));
  return Math.max(0,Math.min(255,score));
}

export function shouldPromoteAttention(priority,{threshold=96}={}){
  return Number(priority)>=threshold;
}
