import {REVIEW_VFX_LIBRARY_EFFECTS,REVIEW_VFX_LIBRARY_COUNT} from './rebuild/review-vfx-library-manifest.js';

const cue=(effect,anchor='impact',options={})=>Object.freeze({
  effect,anchor,scale:options.scale??1,lifetime:options.lifetime??null,priority:options.priority??2,
  offset:Object.freeze(options.offset??[0,0,0]),
});
const entry=row=>Object.freeze({...row,effects:Object.freeze(row.effects),tags:Object.freeze(row.tags),cues:Object.freeze(row.cues??[])});

export const REVIEW_EFFECT_CATEGORIES=Object.freeze({
  attack:'攻撃',impact:'被弾',support:'支援',elemental:'属性',finisher:'大技',combo:'複合',
});

const CORE_EFFECTS=[
  entry({id:'slash',label:'斬撃＋命中',category:'attack',kind:'gameplay',mode:'combat',context:'slash',effects:['impact','slash'],tags:['斬撃','近接','命中','剣','ゲーム採用']}),
  entry({id:'impact',label:'被弾',category:'impact',kind:'gameplay',mode:'combat',context:'impact',effects:['impact'],tags:['被弾','ヒット','衝撃','ゲーム採用']}),
  entry({id:'finisher',label:'急・大技',category:'finisher',kind:'gameplay',mode:'combat',context:'finisher',effects:['finisher','slash'],tags:['急','大技','フィニッシャー','光','ゲーム採用']}),
  entry({id:'storm',label:'派手さ確認',category:'combo',kind:'gameplay',mode:'combat',context:'storm',effects:['finisher','impact','slash'],tags:['複合','派手','ストレステスト','ゲーム採用']}),
  entry({id:'original-ribbon',label:'Sword Ribbon・原本',category:'attack',kind:'original',mode:'raw',context:'slash',effects:['slash'],tags:['原本','剣','軌跡','リボン'],cues:[cue('slash','source',{lifetime:.9})]}),
  entry({id:'original-toon-hit',label:'ToonHit・原本',category:'impact',kind:'original',mode:'raw',context:'impact',effects:['impact'],tags:['原本','被弾','ヒット','衝撃'],cues:[cue('impact','impact',{lifetime:1.3,priority:3})]}),
  entry({id:'original-light',label:'Light・原本',category:'finisher',kind:'original',mode:'raw',context:'finisher',effects:['finisher'],tags:['原本','光','大技','オーラ'],cues:[cue('finisher','impact',{lifetime:2,priority:3})]}),
  entry({id:'original-arrow',label:'Arrow・原本',category:'attack',kind:'original',mode:'raw',context:'slash',effects:['arrow'],tags:['原本','矢','飛び道具','射撃'],cues:[cue('arrow','source',{lifetime:1.6,priority:2})]}),
  entry({id:'original-blow',label:'Blow・原本',category:'impact',kind:'original',mode:'raw',context:'impact',effects:['blow'],tags:['原本','打撃','衝撃','バースト'],cues:[cue('blow','impact',{lifetime:1.3,priority:2})]}),
  entry({id:'original-cure',label:'Cure・原本',category:'support',kind:'original',mode:'raw',context:'slash',effects:['cure'],tags:['原本','回復','支援','ヒール'],cues:[cue('cure','source',{lifetime:2.2,priority:2})]}),
  entry({id:'original-water',label:'ToonWater・原本',category:'elemental',kind:'original',mode:'raw',context:'finisher',effects:['water'],tags:['原本','水','属性','魔法'],cues:[cue('water','impact',{lifetime:1.7,priority:3})]}),
  entry({id:'arrow-hit',label:'Arrow × ToonHit',category:'combo',kind:'composition',mode:'raw',context:'slash',effects:['arrow','impact'],tags:['比較構成','矢','命中','射撃'],cues:[cue('arrow','source',{lifetime:1.6}),cue('impact','impact',{lifetime:1.2,priority:3})]}),
  entry({id:'blow-ribbon',label:'Blow × Ribbon',category:'combo',kind:'composition',mode:'raw',context:'impact',effects:['blow','slash'],tags:['比較構成','打撃','軌跡','近接'],cues:[cue('slash','source',{scale:1.15,lifetime:.8}),cue('blow','impact',{scale:1.1,lifetime:1.3,priority:3})]}),
  entry({id:'cure-light',label:'Cure × Light',category:'support',kind:'composition',mode:'raw',context:'finisher',effects:['cure','finisher'],tags:['比較構成','回復','光','支援'],cues:[cue('cure','source',{lifetime:2.2}),cue('finisher','source',{scale:.72,lifetime:1.8,priority:3})]}),
  entry({id:'water-hit',label:'Water × ToonHit',category:'elemental',kind:'composition',mode:'raw',context:'finisher',effects:['water','impact'],tags:['比較構成','水','命中','魔法'],cues:[cue('water','impact',{lifetime:1.7,priority:3}),cue('impact','impact',{scale:.8,lifetime:1.1,priority:2})]}),
  entry({id:'water-slash',label:'Water × Ribbon',category:'elemental',kind:'composition',mode:'raw',context:'slash',effects:['water','slash'],tags:['比較構成','水','斬撃','属性剣'],cues:[cue('slash','source',{scale:1.15,lifetime:.85}),cue('water','impact',{scale:.78,lifetime:1.5,priority:3})]}),
];

function libraryCategory(effect){
  const name=effect.sourcePath.split('/').pop()||effect.sourcePath;
  if(/Sword|Spear|Claw|Arrow|Gun|Ribbon|drill|BloodLance/i.test(name))return'attack';
  if(/Blow|hit_eff|Impact|SonicBoom|MonsterRoar/i.test(name))return'impact';
  if(/HealPotion|MagicHeal|PowerUp|Benediction|Shield|magic_circle/i.test(name))return'support';
  if(/boss_death|FeatherBomb|GateOfCalve|Meteor|Meteo|LightningStrike|HolySandstorm/i.test(name))return'finisher';
  if(/Fire|Flame|Dark|Light|Magic|Thunder|Wind|Soil|Cold|Water|Cosmic|Snowstorm|electric/i.test(name))return'elemental';
  return'combo';
}
function libraryLabel(effect){
  const name=(effect.sourcePath.split('/').pop()||effect.id).replace(/\.efkefc$/i,'');
  return name.replace(/^(?:AndrewFM01|NextSoft01|Pierre01|Pierre02|Suzuki01|Tktk01|Tktk02|Tktk03)_/,'').replaceAll('_',' ');
}
function libraryEntry(effect){
  const category=libraryCategory(effect);
  const context=category==='attack'?'slash':category==='impact'?'impact':category==='support'?'finisher':category==='elemental'?'finisher':'storm';
  const anchor=category==='attack'||category==='support'?'source':'impact';
  const group=effect.sourcePath.split('/')[0];
  return entry({
    id:`source-${effect.id}`,label:libraryLabel(effect),category,kind:'original',mode:'raw',context,
    realSource:true,sourcePath:effect.sourcePath,author:effect.author,effects:[effect.id],
    tags:['実素材','原本','CC0',effect.author,group,category],
    cues:[cue(effect.id,anchor,{lifetime:effect.lifetime,priority:3})],
  });
}
const REAL_SOURCE_EFFECTS=REVIEW_VFX_LIBRARY_EFFECTS.map(libraryEntry);

export const REVIEW_REAL_EFFECT_COUNT=REVIEW_VFX_LIBRARY_COUNT;
export const REVIEW_EFFECT_CATALOG=Object.freeze([...CORE_EFFECTS,...REAL_SOURCE_EFFECTS]);
export const REVIEW_EFFECT_COUNT=REVIEW_EFFECT_CATALOG.length;
