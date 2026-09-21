import {BASIC_FORMS,ACTION_FORMS} from '@soul/game-data/combat-forms';
import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';

export const REVIEW_TECHNIQUE_PHASES=Object.freeze(['jo','ha','kyu']);
export const MAX_REVIEW_CHAIN=3;
const PHASE_LABEL=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const ACTION_NAME=Object.freeze({
  'action.guard-step':'受流し','action.slip':'霞抜け','action.lunge':'踏込突き','action.counter':'返し',
  'action.feint':'誘い','action.flow':'流連','action.breakfall':'受身','action.finish':'止め',
  'action.side-step':'横流し','action.circle':'廻り','action.crash':'崩打','action.draw':'抜打',
  'action.recover':'残心','action.precision':'精突',
});
const BASIC_NAME=Object.freeze({sword:'剣の型',fist:'徒手の型',dagger:'短剣の型',great:'大剣の型',spear:'槍の型',axe:'戦斧の型',staff:'杖の型'});
const cloneStep=(kind,footwork='stay',charge='none')=>Object.freeze({kind:String(kind||'ready'),footwork:String(footwork||'stay'),charge:String(charge||'none')});
function techniqueFromForm(id,name,form){
  const kinds=form?.kinds||['ready'],feet=form?.feet||[],charges=form?.charges||[];
  return Object.freeze({id,name,steps:Object.freeze(kinds.slice(0,3).map((kind,index)=>cloneStep(kind,feet[index],charges[index]))),rhythm:form?.rhythm||'flow',tempo:Number(form?.tempo)||1});
}
export function reviewTechniqueDefinition(id,{weapon='sword',phase='jo'}={}){
  const form=id===`basic.${weapon}`?(BASIC_FORMS[weapon]||BASIC_FORMS.sword):ACTION_FORMS[id];if(!form)return null;
  const technique=techniqueFromForm(id,id===`basic.${weapon}`?(BASIC_NAME[weapon]||'基本の型'):(ACTION_NAME[id]||id),form);
  const supported=technique.steps.every(step=>resolveJohakyuMotion({weapon,kind:step.kind,charge:step.charge,phase}).supported);
  return supported?technique:null;
}
export function createCanonicalReviewComposition({weapon='sword'}={}){
  const ids={jo:[`basic.${weapon}`,'action.feint'],ha:['action.guard-step','action.counter','action.flow'],kyu:['action.lunge','action.finish']};
  return Object.freeze(Object.fromEntries(REVIEW_TECHNIQUE_PHASES.map(phase=>[phase,Object.freeze(ids[phase].map(id=>reviewTechniqueDefinition(id,{weapon,phase})).filter(Boolean).slice(0,MAX_REVIEW_CHAIN))])));
}
export function reviewTechniqueStageLabel(technique,index){return Object.freeze({phaseLabel:null,technique:technique.name,stage:index+1,stageLabel:`${index+1}段`,step:technique.steps[index]??null});}
export function reviewChainLabel(phase,composition){const count=composition?.[phase]?.length||0;return`${PHASE_LABEL[phase]||phase}・${count}連`;}
export function reviewChainSnapshot(composition){return Object.freeze(Object.fromEntries(REVIEW_TECHNIQUE_PHASES.map(phase=>[phase,Object.freeze((composition?.[phase]||[]).map(technique=>Object.freeze({id:technique.id,name:technique.name,stages:technique.steps.length})))])));}
