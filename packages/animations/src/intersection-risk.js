import { segmentDistance, mix } from './quality-math.js';

/** Small capsule proxy pass. Positive penetration is a RISK, not mesh contact proof.
 * Optional cloth/hair proxies come from a renderer/DCC adapter; absent geometry is
 * explicitly listed for visual review rather than silently marked clear.
 */
export function selfIntersectionRisks({points,torsoRadius,armRadius,weapon=null,proxies=[]}) {
  const p=points,issues=[],torso={a:p.hips,b:p.upperChest??p.chest??p.spine,radius:torsoRadius};
  if(!torso.a||!torso.b)return {issues,visualRequired:['model','rig','skinning / weight','clothing','hair','silhouette']};
  const test=(a,b,category,code,bones)=>{
    const penetration=a.radius+b.radius-segmentDistance(a.a,a.b,b.a,b.b);
    if(penetration>0)issues.push({category,severity:penetration>armRadius*.65?'error':'warning',affectedBones:bones,code,penetration,method:'capsule-risk'});
  };
  const arms=[];
  for(const side of ['left','right']) {
    const a=p[side+'UpperArm'],b=p[side+'LowerArm'],c=p[side+'Hand'];if(!a||!b||!c)continue;
    const upper={a:mix(a,b,.35),b,radius:armRadius},lower={a:b,b:c,radius:armRadius*.85},hand={a:c,b:c,radius:armRadius};
    test(upper,torso,'self intersection','arm-torso',[side+'UpperArm',side+'LowerArm']);
    test(lower,torso,'self intersection','forearm-torso',[side+'LowerArm',side+'Hand']);
    test(hand,torso,'self intersection','hand-body',[side+'Hand']);arms.push({side,upper,lower});
    if(weapon){test(weapon,upper,'weapon grip','weapon-arm',[side+'UpperArm']);test(weapon,lower,'weapon grip','weapon-forearm',[side+'LowerArm']);}
  }
  if(arms.length===2)for(const a of ['upper','lower'])for(const b of ['upper','lower'])test(arms[0][a],arms[1][b],'self intersection','arms-cross',['leftUpperArm','rightUpperArm']);
  if(weapon)test(weapon,torso,'weapon grip','weapon-body',['rightHand','spine']);
  for(const proxy of proxies)test(proxy,torso,proxy.category,proxy.category+'-body',proxy.bones??[]);
  return {issues,visualRequired:['model','rig','skinning / weight','clothing','hair','silhouette']};
}
