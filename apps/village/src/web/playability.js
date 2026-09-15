export const ENTRY_SEEN_KEY='mura.village.entry-seen.v1';

export const TUTORIAL_REASONS={
 tent:'寝床が増えると、食事と守りに余裕があるぶんだけ旅人を迎えられます。',
 logging:'丸太を初めて得ると、木工所や詰所など次の施設が見えるようになります。',
 wheat:'食料があるほど暮らしが安定し、新しい住人を迎える余裕が生まれます。',
 carpenter:'板材は家や見張り台など、村を一段広げるための建材になります。',
 guardpost:'警備職が生まれると生活圏の安全が上がり、移住者を安心して迎えられます。',
};

export function tutorialReason(step){
 return step?TUTORIAL_REASONS[step.kind]||step.text||'この一手が、次の村の変化につながります。':'';
}

export function shouldSkipEntry(value){return value==='1';}

export function objectTapRadius({viewportWidth=390,viewportHeight=844,span=40,def={}}={}){
 const mobile=viewportWidth<700,base=mobile?38:28,pixelsPerWorld=viewportHeight/Math.max(10,span);
 const footprint=Math.max(Number(def.w)||1,Number(def.d)||1)*pixelsPerWorld*.22;
 return Math.max(base,Math.min(mobile?62:50,base+footprint));
}

export function nearestProjectedObject({objects=[],defs={},project,resolvePosition=o=>o,x=0,y=0,viewportWidth=390,viewportHeight=844,span=40}){
 if(typeof project!=='function')return null;
 let best=null,bestScore=Infinity;
 for(const object of objects){
  const def=defs[object.kind];if(!def)continue;
  const position=resolvePosition(object);if(!position)continue;
  const point=project(position.x,def.building?1.05:.45,position.z);
  if(!point||point.x<8||point.x>viewportWidth-8||point.y<72||point.y>viewportHeight-76)continue;
  const radius=objectTapRadius({viewportWidth,viewportHeight,span,def}),distance=Math.hypot(point.x-x,point.y-y);
  if(distance>radius)continue;
  const score=distance/radius;
  if(score<bestScore){bestScore=score;best=object.id;}
 }
 return best;
}

export function feedbackTone(text='',type='life'){
 if(type==='threat'||type==='loss'||/魔王軍|襲撃|負傷|倒れ/.test(text))return 'danger';
 if(/利用可能|発見|初めて|解放|板材|丸太|石|粘土|鉄/.test(text))return 'unlock';
 if(/建て|置き|寝床|増築|迎え|移住|完成/.test(text))return 'growth';
 if(type==='rescue'||type==='voyage')return 'event';
 return 'quiet';
}

export function shouldCelebrate(text='',type='life'){
 return feedbackTone(text,type)!=='quiet';
}
