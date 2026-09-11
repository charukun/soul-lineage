/** Render-only ribbon topology. No game RNG, hit events or simulation time are changed. */
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function sameStroke(a,b) {
  return a.attackId===b.attackId&&(a.group??0)===(b.group??0)
    &&a.weapon===b.weapon&&a.element===b.element;
}
export function stableSeed(value) {
  let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return (h>>>0)/4294967296;
}
export function ribbonFade(age,life) {
  if (!Number.isFinite(age)||!(life>0))return 0;
  const u=Math.min(1,Math.max(0,age/life));return (1-u)*(1-u)*(1-u*.35);
}
/** Bounded per-actor mesh budget. Retained samples connect all intervening valid samples.
 * Stroke gaps, teleports, invalid coordinates and weapon changes always break strips.
 * Thin spatial segments are decimated, but turning points and the newest tip survive.
 */
export function trailSegments(samples,quality=1) {
  const cap=quality===0?40:quality===1?72:112,threshold=quality===0?.045:.018;
  const groups=[];let run=[];
  for(const sample of samples){
    if(!finitePoint(sample.a)||!finitePoint(sample.b)||!Number.isFinite(sample.age)){if(run.length>1)groups.push(run);run=[];continue;}
    const old=run.at(-1),jump=old&&Math.max(distance(old.a,sample.a),distance(old.b,sample.b));
    const timeGap=old&&Number.isFinite(old.sampleTime)&&Number.isFinite(sample.sampleTime)?sample.sampleTime-old.sampleTime:0;
    if(old&&(!sameStroke(old,sample)||jump>.8||timeGap<0||timeGap>.08)){if(run.length>1)groups.push(run);run=[];}
    run.push(sample);
  }
  if(run.length>1)groups.push(run);
  const result=[];
  for(const rows of groups){let anchor=rows[0];for(let i=1;i<rows.length;i++){
    const b=rows[i],move=Math.max(distance(anchor.a,b.a),distance(anchor.b,b.b));
    if(move>=threshold||i===rows.length-1){if(move>1e-6)result.push([anchor,b]);anchor=b;}
  }}
  // Decimate within the same run before applying the hard budget; never bridge an id change.
  if(result.length<=cap)return result;
  const stride=Math.ceil(result.length/cap),out=[];
  for(let i=0;i<result.length;){let j=i;while(j+1<Math.min(result.length,i+stride)&&result[j][1]===result[j+1][0])j++;out.push([result[i][0],result[j][1]]);i=j+1;}
  return out.slice(-cap);
}
export function vertexBudget(current,capacity,needed,reserve=256) {
  return Number.isInteger(needed)&&needed>=0&&current>=0&&current+needed<=capacity-reserve;
}
