import {hash,random} from './world.js';

export const DEFAULT_MONSTER_SPECIES='night-creature';
const profile=(minScale,maxScale,fullMeals,curve,minHpScale,maxHpScale,minPowerScale,maxPowerScale,minMoveScale,maxMoveScale,minClearance,maxClearance)=>Object.freeze({minScale,maxScale,fullMeals,curve,minHpScale,maxHpScale,minPowerScale,maxPowerScale,minMoveScale,maxMoveScale,minClearance,maxClearance});
const technique=(id,name)=>Object.freeze({id,name});

export const MONSTER_SPECIES=Object.freeze({
 [DEFAULT_MONSTER_SPECIES]:Object.freeze({
  id:DEFAULT_MONSTER_SPECIES,label:'夜喰い',model:null,weapon:'fist',
  growth:profile(.28,3.2,10,1.7,.24,1.55,.55,1.35,.72,1.12,.18,.92),
  techniques:Object.freeze({jo:technique('ember','飢爪・裂肉'),ha:technique('dancer','屍爪・返し'),kyu:technique('calm','喰顎・断ち')})
 }),
 'goblin-runt':Object.freeze({
  id:'goblin-runt',label:'餓小鬼',model:'goblin-runt',weapon:'fist',
  growth:profile(.28,2.0,6,2.0,.20,1.0,.50,1.0,.90,1.35,.18,.58),
  techniques:Object.freeze({jo:technique('dancer','小鬼爪・駆け裂き'),ha:technique('ember','餓童・脇潜り'),kyu:technique('dancer','群喰・噛み抜き')})
 }),
 'horn-brute':Object.freeze({
  id:'horn-brute',label:'角暴鬼',model:'horn-brute',weapon:'fist',
  growth:profile(.32,3.2,12,1.3,.28,1.85,.65,1.55,.65,.95,.20,.92),
  techniques:Object.freeze({jo:technique('stone','角突・穿ち'),ha:technique('calm','剛腕・地割り'),kyu:technique('stone','暴喰・叩き伏せ')})
 }),
 'maw-stalker':Object.freeze({
  id:'maw-stalker',label:'裂顎影',model:'maw-stalker',weapon:'fist',
  growth:profile(.28,2.7,8,1.8,.20,1.15,.52,1.20,1.0,1.45,.18,.72),
  techniques:Object.freeze({jo:technique('shadow','鎌爪・斜断'),ha:technique('dancer','潜影・喉裂き'),kyu:technique('ember','尾返・抉り')})
 }),
 'grave-ogre':Object.freeze({
  id:'grave-ogre',label:'墓喰大鬼',model:'grave-ogre',weapon:'fist',
  growth:profile(.36,3.2,14,1.2,.34,2.10,.75,1.70,.58,.86,.22,.92),
  techniques:Object.freeze({jo:technique('stone','墓腕・圧し潰し'),ha:technique('calm','石喰・踏み砕き'),kyu:technique('stone','巨顎・地鳴り')})
 }),
 'night-bat':Object.freeze({
  id:'night-bat',label:'夜蝙蝠',model:'night-bat',weapon:'fist',
  growth:profile(.28,1.7,7,2.2,.16,.78,.45,.90,1.15,1.70,.18,.48),
  techniques:Object.freeze({jo:technique('shadow','夜翼・裂風'),ha:technique('dancer','血啜・翻り'),kyu:technique('ember','月牙・急襲')})
 })
});

export const MONSTER_SPECIES_IDS=Object.freeze(Object.keys(MONSTER_SPECIES));
export const MONSTER_GROWTH_PROFILES=Object.freeze(Object.fromEntries(MONSTER_SPECIES_IDS.map(id=>[id,MONSTER_SPECIES[id].growth])));
export function monsterSpeciesFor(species=DEFAULT_MONSTER_SPECIES){return MONSTER_SPECIES[species]||MONSTER_SPECIES[DEFAULT_MONSTER_SPECIES];}
export function growthProfileFor(species=DEFAULT_MONSTER_SPECIES){return monsterSpeciesFor(species).growth;}
export function chooseMonsterSpecies(villageId,preferred=null){
 if(preferred&&Object.hasOwn(MONSTER_SPECIES,preferred))return preferred;
 const rng=random(hash(`monster:${String(villageId||'village')}`));return MONSTER_SPECIES_IDS[Math.min(MONSTER_SPECIES_IDS.length-1,Math.floor(rng()*MONSTER_SPECIES_IDS.length))];
}
export function feedingGrowth(meals=0,species=DEFAULT_MONSTER_SPECIES){
 const growth=growthProfileFor(species),n=Math.max(0,Math.floor(Number(meals)||0)),progress=Math.min(1,n/growth.fullMeals),shaped=1-Math.pow(1-progress,growth.curve),lerp=(a,b)=>a+(b-a)*shaped;
 return{species:monsterSpeciesFor(species).id,progress,scale:lerp(growth.minScale,growth.maxScale),hpScale:lerp(growth.minHpScale,growth.maxHpScale),powerScale:lerp(growth.minPowerScale,growth.maxPowerScale),moveScale:lerp(growth.minMoveScale,growth.maxMoveScale),clearance:lerp(growth.minClearance,growth.maxClearance)};
}
