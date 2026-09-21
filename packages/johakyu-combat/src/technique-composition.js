import {ACTION_FORMS,BASIC_FORMS,adaptKind} from '@soul/game-data/combat-forms';

export const REVIEW_TECHNIQUE_PHASES=Object.freeze([['jo','序'],['ha','破'],['kyu','急']]);
export const MAX_TECHNIQUES_PER_CHAIN=3;
const STAGE_LABELS=Object.freeze(['一段','二段','三段']);
const CHAIN_LABELS=Object.freeze(['零連','一連','二連','三連']);
const cloneStep=step=>({kind:String(step?.kind||'ready'),footwork:String(step?.footwork||'stay'),charge:String(step?.charge||'none')});

export function normalizeReviewTechnique(technique,{fallbackId='basic',fallbackName='基本技'}={}){
  const steps=(Array.isArray(technique?.steps)?technique.steps:[]).slice(0,3).map(cloneStep);
  if(!steps.length)steps.push(cloneStep());
  return Object.freeze({
    id:String(technique?.id||fallbackId),name:String(technique?.name||fallbackName),
    rhythm:String(technique?.rhythm||'flow'),tempo:Number.isFinite(technique?.tempo)?technique.tempo:1,
    steps:Object.freeze(steps)
  });
}
export function techniqueFromCombatForm(id,{weapon='sword',name=id}={}){
  const basic=id===`basic.${weapon}`,form=basic?BASIC_FORMS[weapon]:ACTION_FORMS[id];
  if(!form)throw new RangeError('Unregistered combat form: '+id);
  return normalizeReviewTechnique({id,name,rhythm:form.rhythm||'flow',tempo:form.tempo||1,
    steps:form.kinds.map((raw,index)=>({kind:adaptKind(raw,weapon),footwork:form.feet?.[index]||'stay',charge:form.charges?.[index]||'none'}))});
}
export function createReviewTechniqueComposition(){return{jo:[],ha:[],kyu:[]};}
export function addTechniqueToReviewChain(composition,phase,technique){
  if(!composition||!REVIEW_TECHNIQUE_PHASES.some(([id])=>id===phase))return null;
  const normalized=normalizeReviewTechnique(technique,{fallbackId:`${phase}-basic`}),rows=composition[phase];
  const duplicate=rows.findIndex(row=>row.id===normalized.id);if(duplicate>=0)rows.splice(duplicate,1);
  rows.push(normalized);while(rows.length>MAX_TECHNIQUES_PER_CHAIN)rows.shift();return normalized;
}
export function reviewTechniqueStages(technique){
  return normalizeReviewTechnique(technique).steps.map((step,index)=>Object.freeze({index,label:STAGE_LABELS[index]||`${index+1}段`,kind:step.kind,step}));
}
export function flattenReviewTechniqueChain(chain){return(chain||[]).flatMap(technique=>reviewTechniqueStages(technique).map(stage=>({...stage.step})));}
export function reviewChainLabel(phase,count=0){const phaseLabel=REVIEW_TECHNIQUE_PHASES.find(([id])=>id===phase)?.[1]||phase;return`${phaseLabel} · ${CHAIN_LABELS[Math.min(3,Math.max(0,Number(count)||0))]||`${count}連`}`;}
export function compileTechniqueComposition(composition,{weapon='sword'}={}){
  const out={};
  for(const [phase] of REVIEW_TECHNIQUE_PHASES){
    out[phase]=Object.freeze((composition?.[phase]||[]).map(technique=>{
      const normalized=normalizeReviewTechnique(technique),stages=reviewTechniqueStages(normalized).map(stage=>Object.freeze({
        ...stage,step:Object.freeze({...stage.step}),phase,techniqueId:normalized.id,techniqueName:normalized.name,weapon
      }));
      return Object.freeze({...normalized,phase,stages:Object.freeze(stages)});
    }));
  }
  return Object.freeze(out);
}
