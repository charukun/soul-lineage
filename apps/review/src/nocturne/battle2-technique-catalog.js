import {ACTION_FORMS,BASIC_FORMS} from '@soul/game-data/combat-forms';
import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';
import {resolveTechniquePresentation} from '@soul/johakyu-presentation/technique-presentation';
const PRESENTATION_CLIPS=Object.freeze({
 oneHandStab:'1H_Melee_Attack_Stab',oneHandChop:'1H_Melee_Attack_Chop',oneHandHorizontal:'1H_Melee_Attack_Slice_Horizontal',oneHandDiagonal:'1H_Melee_Attack_Slice_Diagonal',
 twoHandStab:'2H_Melee_Attack_Stab',twoHandSpin:'2H_Melee_Attack_Spinning',twoHandChop:'2H_Melee_Attack_Chop',twoHandSlice:'2H_Melee_Attack_Slice',
 fistPunch:'Unarmed_Melee_Attack_Punch_A',fistKick:'Unarmed_Melee_Attack_Kick'
});
const LABELS=Object.freeze({'basic.sword':'剣の型','action.guard-step':'受け流し歩法','action.slip':'流し身','action.lunge':'伸び足','action.counter':'返し','action.feint':'誘い','action.flow':'連環','action.breakfall':'崩し受身','action.finish':'詰め','action.side-step':'外し歩','action.circle':'廻り込み','action.crash':'打ち崩し','action.draw':'初太刀','action.recover':'残心','action.precision':'一点通し'});
const formFor=id=>id==='basic.sword'?BASIC_FORMS.sword:ACTION_FORMS[id],ids=['basic.sword',...Object.keys(ACTION_FORMS)];
function formSteps(form){return form.kinds.map((kind,index)=>({kind,footwork:form.feet?.[index]||'stay',charge:form.charges?.[index]||'none'}));}
function catalogRow(id){const form=formFor(id),steps=formSteps(form),motions=steps.map(row=>resolveJohakyuMotion({weapon:'sword',kind:row.kind,charge:row.charge,phase:'jo'})),presentation=resolveTechniquePresentation({techniqueId:id,weapon:'sword',phase:'jo',steps});return Object.freeze({id,label:LABELS[id]||id,meta:form.kinds.join(' / '),motions:Object.freeze(motions),presentation,supported:motions.every(row=>row.supported)});}
export const BATTLE2_TECHNIQUE_CATALOG=Object.freeze(ids.map(catalogRow).filter(row=>row.supported));
const chain=(...techniques)=>Object.freeze(techniques.slice(0,3));
export const BATTLE2_COMBO_PRESETS=Object.freeze([
 Object.freeze({id:'combo-1',label:'壱ノ連',techniques:chain('action.feint','action.counter','action.precision')}),
 Object.freeze({id:'combo-2',label:'弐ノ連',techniques:chain('action.side-step','action.guard-step','action.crash')}),
 Object.freeze({id:'combo-3',label:'参ノ連',techniques:chain('action.slip','action.flow','action.finish')}),
 Object.freeze({id:'combo-4',label:'肆ノ連',techniques:chain('action.lunge','action.circle','action.draw')}),
 Object.freeze({id:'combo-5',label:'伍ノ連',techniques:chain('action.breakfall','action.recover')}),
 Object.freeze({id:'combo-6',label:'陸ノ連',techniques:chain('basic.sword')})
]);
const BASIC_LABELS=Object.freeze({sword:'剣の型',great:'大剣の型',dagger:'短剣の型',spear:'槍の型',axe:'戦斧の型',staff:'杖の型',fist:'徒手の型'});
export const battle2ComboSelection=id=>'combo:'+id;
export const battle2TechniqueLabel=id=>String(id||'').startsWith('basic.')?(BASIC_LABELS[String(id).slice(6)]||'基本の型'):(LABELS[id]||id||'未設定');
export function battle2SelectionLabel(selection){const raw=String(selection||'');if(raw.startsWith('combo:'))return BATTLE2_COMBO_PRESETS.find(row=>row.id===raw.slice(6))?.label||'連技';return battle2TechniqueLabel(raw);}
export function battle2SelectionAllowed(selection){const raw=String(selection||'');if(raw.startsWith('combo:'))return BATTLE2_COMBO_PRESETS.some(row=>row.id===raw.slice(6));return BATTLE2_TECHNIQUE_CATALOG.some(row=>row.id===raw);}
export function battle2SelectionTechniques(selection,{weapon='sword'}={}){const raw=String(selection||''),combo=raw.startsWith('combo:')?BATTLE2_COMBO_PRESETS.find(row=>row.id===raw.slice(6)):null,chosen=combo?.techniques?.length?combo.techniques:[raw||'basic.sword'];return Object.freeze(chosen.slice(0,3).map(id=>id.startsWith('basic.')?'basic.'+weapon:id));}

export function battle2TechniquePresentation(technique,{weapon='sword',phase='jo',stageIndex=0}={}){
 const steps=Array.isArray(technique?.steps)?technique.steps:[],profile=resolveTechniquePresentation({techniqueId:technique?.id||'',weapon,phase,steps}),segment=profile.motion.segments[Math.max(0,Math.min(profile.motion.segments.length-1,Number(stageIndex)||0))]||profile.motion.segments[0],clip=PRESENTATION_CLIPS[segment?.clipRole]||null;
 return Object.freeze({id:profile.id,archetype:profile.archetype,clip,segment,vfx:profile.vfx,sfx:profile.sfx,camera:profile.camera,contact:profile.contact});
}
