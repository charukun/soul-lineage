import {BASIC_FORMS} from '@soul/game-data/combat-forms';
import {resolveInspirationAnswer} from '@soul/game-data';
import {resolveJohakyuMotion} from '@soul/johakyu-presentation/motion-bindings';
import {skillDefinition} from './skill-system.js';
import {techniqueName} from '../combat-loadout.js';

const freeze=Object.freeze;
const basic=id=>typeof id==='string'&&id.startsWith('basic.')&&Object.hasOwn(BASIC_FORMS,id.slice(6));
/** The current executor recipe owns identity even after the next policy changes. */
export function executedTechniqueId(actor){
  if(actor?.execution?.techniqueId)return actor.execution.techniqueId;
  const id=actor?.execution?.recipeId;
  return typeof id==='string'&&/^rinne-(jo|ha|kyu)-/.test(id)?id.replace(/^rinne-(jo|ha|kyu)-/,''):null;
}
export function readJohakyuTechniqueTruth(state,frame,{sessionId=null}={}){
  const execution=frame?.execution;if(!execution)return null;
  const techniqueId=executedTechniqueId(frame),definition=skillDefinition(techniqueId),answer=resolveInspirationAnswer(techniqueId);
  const pending=state.inspiration?.pending,record=state.inspiration?.records?.[techniqueId];
  const registered=basic(techniqueId)||Boolean(definition||answer);
  const learned=registered&&(state.knownSkills||[]).includes(techniqueId)&&!record?.archived;
  const trial=registered&&!learned&&pending?.id===techniqueId&&pending.armed&&!pending.failed&&!pending.committed&&pending.targetId===frame.targetId&&pending.phase===execution.phase;
  const isBasic=basic(techniqueId)&&techniqueId===`basic.${state.equipment.weapon}`;
  const reaction=!techniqueId&&['rinne-threat-guard','rinne-enemy-observe'].includes(execution.recipeId)||String(execution.recipeId||'').startsWith('rinne-uke-');
  const status=isBasic?'basic':learned?'learned':trial?'trial':reaction?'reaction':'unregistered';
  const motion=resolveJohakyuMotion({weapon:execution.weapon,kind:execution.kind,charge:execution.charge,phase:execution.phase??'enemy'});
  return freeze({authority:'rinne-domain',status,techniqueId:registered?techniqueId:null,
    name:registered?techniqueName(techniqueId,state):reaction?'受け':null,
    attackId:sessionId?`${sessionId}:${execution.attackId}`:String(execution.attackId),phase:execution.phase,stepIndex:execution.stepIndex,
    targetId:frame.targetId,learned,trial,equipped:Object.values(state.combatLoadout?.technique?.combos?.find(c=>c.id===state.combatLoadout?.technique?.activeComboId)?.slots||{}).includes(techniqueId),
    legal:status!=='unregistered',motion});
}
/** Explicit read-only profile for diagnostics, not a second catalog or command. */
export function readJohakyuLoadoutProfile(state){
  const loadout=state.combatLoadout||{},technique=loadout.technique||{};
  const ids=[...new Set([`basic.${state.equipment.weapon}`,...(state.knownSkills||[]),...Object.values(technique.combos?.find(c=>c.id===technique.activeComboId)?.slots||{})])];
  return freeze({authority:'rinne-domain',readOnly:true,lifeId:state.id,
    equipment:freeze({...state.equipment}),heart:freeze([...(loadout.heart?.active||[])]),body:freeze({...loadout.body}),
    activeComboId:technique.activeComboId??null,combos:freeze((technique.combos||[]).map(c=>freeze({id:c.id,name:c.name,slots:freeze({...c.slots})}))),
    oneMotion:technique.oneMotion??null,catalog:freeze(ids.filter(id=>basic(id)||skillDefinition(id)).map(id=>freeze({id,name:techniqueName(id,state),learned:(state.knownSkills||[]).includes(id)&&!state.inspiration?.records?.[id]?.archived,basic:basic(id)}))),
    pending:state.inspiration?.pending?freeze({id:state.inspiration.pending.id,status:'trial',committed:Boolean(state.inspiration.pending.committed)}):null});
}

