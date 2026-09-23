const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const phaseScale=phase=>phase==='kyu'||phase==='finisher'?1.22:phase==='ha'?1.06:.86;
const PROFILES=Object.freeze({
 head:{root:[.048,.012,.052,.028],bones:[['head','any',0,.15,.075,.09],['neck','any',.035,.105,.055,.07],['spine','any',.075,.06,.025,.04],['shoulder','any',.1,.025,.02,.035]]},
 torso:{root:[.072,.026,.082,.038],bones:[['spine','any',0,.12,.045,.065],['shoulder','any',.035,.055,.03,.055],['hips','any',.06,.055,.025,.04],['head','any',.1,.042,.02,.035],['upperLeg','any',.115,.025,.015,.025]]},
 arm:{root:[.046,.015,.048,.032],bones:[['shoulder','impact',0,.105,.07,.12],['upperArm','impact',.02,.17,.11,.19],['lowerArm','impact',.045,.19,.13,.22],['hand','impact',.06,.14,.11,.18],['spine','any',.055,.052,.025,.05],['head','any',.11,.032,.02,.03]]},
 leg:{root:[.09,.042,.092,.06],bones:[['upperLeg','impact',0,.12,.065,.13],['lowerLeg','impact',.025,.14,.075,.16],['foot','impact',.045,.095,.055,.12],['hips','any',.035,.105,.055,.095],['spine','any',.08,.06,.025,.052],['head','any',.13,.026,.015,.026]]}
});
export function impactReactionEnvelope(progress,delay=0){
 const p=clamp((clamp(progress)-clamp(delay,0,.8))/Math.max(.05,1-clamp(delay,0,.8)));if(p<=0)return 0;
 return p<.13?p/.13:Math.exp(-(p-.13)*4.35);
}
export function impactReactionProfile({bodyPart='torso',phase='ha',heavy=false,strength=1}={}){
 const limbSide=String(bodyPart).startsWith('left')?-1:String(bodyPart).startsWith('right')?1:0;
 const family=bodyPart==='head'?'head':/Arm$/.test(bodyPart)?'arm':/Leg$/.test(bodyPart)?'leg':'torso',base=PROFILES[family];
 const scale=clamp(strength,.35,1.75)*phaseScale(phase)*(heavy?1.16:1);
 const [push,drop,pitch,roll]=base.root;
 return Object.freeze({family,bodyPart,limbSide,scale,root:Object.freeze({push:push*scale,drop:drop*scale,pitch:pitch*scale,roll:roll*scale}),
  bones:Object.freeze(base.bones.map(([kind,side,delay,x,y,z])=>Object.freeze({kind,side,delay,pitch:x*scale,yaw:y*scale,roll:z*scale})))});
}
