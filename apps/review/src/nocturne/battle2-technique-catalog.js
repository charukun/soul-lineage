import {ACTION_FORMS,BASIC_FORMS} from '@soul/game-data/combat-forms';
import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';
const LABELS=Object.freeze({'basic.sword':'剣の型','action.guard-step':'受け流し歩法','action.slip':'流し身','action.lunge':'伸び足','action.counter':'返し','action.feint':'誘い','action.flow':'連環','action.breakfall':'崩し受身','action.finish':'詰め','action.side-step':'外し歩','action.circle':'廻り込み','action.crash':'打ち崩し','action.draw':'初太刀','action.recover':'残心','action.precision':'一点通し'});
const formFor=id=>id==='basic.sword'?BASIC_FORMS.sword:ACTION_FORMS[id],ids=['basic.sword',...Object.keys(ACTION_FORMS)];
function catalogRow(id){const form=formFor(id),motions=form.kinds.map((kind,index)=>resolveJohakyuMotion({weapon:'sword',kind,charge:form.charges?.[index]??'none',phase:'jo'}));return Object.freeze({id,label:LABELS[id]||id,meta:form.kinds.join(' / '),motions:Object.freeze(motions),supported:motions.every(row=>row.supported)});}
export const BATTLE2_TECHNIQUE_CATALOG=Object.freeze(ids.map(catalogRow).filter(row=>row.supported));
const slot=(jo,ha,kyu)=>Object.freeze({jo,ha,kyu});
export const BATTLE2_COMBO_PRESETS=Object.freeze([
 Object.freeze({id:'combo-1',label:'壱ノ連',slots:slot('action.feint','action.counter','action.precision')}),
 Object.freeze({id:'combo-2',label:'弐ノ連',slots:slot('action.side-step','action.guard-step','action.crash')}),
 Object.freeze({id:'combo-3',label:'参ノ連',slots:slot('action.slip','action.flow','action.finish')}),
 Object.freeze({id:'combo-4',label:'肆ノ連',slots:slot('action.lunge','action.circle','action.draw')}),
 Object.freeze({id:'combo-5',label:'伍ノ連',slots:slot('action.breakfall','action.recover','action.counter')}),
 Object.freeze({id:'combo-6',label:'陸ノ連',slots:slot('basic.sword','action.flow','action.crash')})
]);
export const battle2TechniqueLabel=id=>LABELS[id]||id;
export function battle2MatchingCombo(technique={}){return BATTLE2_COMBO_PRESETS.find(row=>row.slots.jo===technique.jo&&row.slots.ha===technique.ha&&row.slots.kyu===technique.kyu)?.id??null;}
