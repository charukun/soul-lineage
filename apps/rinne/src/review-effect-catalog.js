const cue=(effect,anchor='impact',options={})=>Object.freeze({
  effect,anchor,scale:options.scale??1,lifetime:options.lifetime??null,priority:options.priority??2,
  offset:Object.freeze(options.offset??[0,0,0]),
});
const entry=(row)=>Object.freeze({...row,effects:Object.freeze(row.effects),tags:Object.freeze(row.tags),cues:Object.freeze(row.cues??[])});

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
];

const SPECTACLE_FAMILIES=Object.freeze([
  {slug:'blade',label:'天断',category:'attack',context:'slash',effects:['slash','impact'],tags:['斬撃','剣','軌跡'],cues:i=>[
    cue('slash','source',{scale:1.15+i*.06,lifetime:.72+i*.025,offset:[0,(i%3)*.08,(i%2?-.12:.12)]}),
    cue('impact','impact',{scale:.72+i*.035,lifetime:1.05,priority:3,offset:[0,(i%4)*.05,0]}),
  ]},
  {slug:'crush',label:'轟砕',category:'impact',context:'impact',effects:['blow','impact','finisher'],tags:['ヒット','打撃','爆発','衝撃'],cues:i=>[
    cue('blow','impact',{scale:.95+i*.055,lifetime:1.1,priority:3}),
    cue('impact','impact',{scale:.7+i*.04,lifetime:1.05,priority:3,offset:[(i%2?-.14:.14),.08,0]}),
    ...(i%3===0?[cue('finisher','impact',{scale:.38+i*.018,lifetime:1.25,priority:3})]:[]),
  ]},
  {slug:'arcana',label:'星呪',category:'elemental',context:'finisher',effects:['water','finisher','impact'],tags:['魔法','属性','水','光'],cues:i=>[
    cue('water','impact',{scale:.72+i*.045,lifetime:1.45,priority:3}),
    cue('finisher','impact',{scale:.34+i*.022,lifetime:1.55,priority:3,offset:[0,.08+(i%3)*.07,0]}),
    ...(i%2===0?[cue('impact','impact',{scale:.55+i*.025,lifetime:.95,priority:2})]:[]),
  ]},
  {slug:'aura',label:'神気',category:'support',context:'finisher',effects:['cure','finisher','water'],tags:['オーラ','回復','支援','光'],cues:i=>[
    cue('cure','source',{scale:.8+i*.035,lifetime:1.8,priority:2}),
    cue('finisher','source',{scale:.3+i*.018,lifetime:1.65,priority:3,offset:[0,.1,0]}),
    ...(i%4===0?[cue('water','source',{scale:.45+i*.015,lifetime:1.35,priority:2})]:[]),
  ]},
  {slug:'cataclysm',label:'終界',category:'finisher',context:'storm',effects:['finisher','impact','blow','slash'],tags:['大技','爆発','奥義','派手'],cues:i=>[
    cue('finisher','impact',{scale:.48+i*.032,lifetime:1.75,priority:3}),
    cue('impact','impact',{scale:.88+i*.045,lifetime:1.1,priority:3,offset:[0,.12,0]}),
    cue('blow','impact',{scale:.82+i*.035,lifetime:1.15,priority:3,offset:[(i%2?-.18:.18),0,0]}),
    cue('slash','source',{scale:1.25+i*.055,lifetime:.82,priority:2}),
  ]},
  {slug:'barrage',label:'千華',category:'combo',context:'storm',effects:['arrow','slash','impact','water'],tags:['複合','連撃','弾幕','派手'],cues:i=>[
    cue('arrow','source',{scale:.9+i*.035,lifetime:1.35,priority:2,offset:[0,(i%3)*.08,0]}),
    cue('slash','source',{scale:1.05+i*.04,lifetime:.72,priority:2,offset:[0,.12,(i%2?-.16:.16)]}),
    cue('impact','impact',{scale:.65+i*.03,lifetime:1,priority:3}),
    ...(i%2===0?[cue('water','impact',{scale:.5+i*.018,lifetime:1.25,priority:2})]:[]),
  ]},
]);

const SPECTACLE_EFFECTS=SPECTACLE_FAMILIES.flatMap((family,familyIndex)=>
  Array.from({length:18},(_,index)=>{
    const n=index+1;
    return entry({
      id:`spectacle-${family.slug}-${String(n).padStart(2,'0')}`,
      label:`${family.label} ${String(n).padStart(2,'0')}`,
      category:family.category,kind:'composition',mode:'raw',context:family.context,
      effects:family.effects,tags:['派手','100種VFX',...family.tags,`series-${familyIndex+1}`],
      cues:family.cues(index),
    });
  })
);

export const REVIEW_EFFECT_CATALOG=Object.freeze([...CORE_EFFECTS,...SPECTACLE_EFFECTS]);
export const REVIEW_EFFECT_COUNT=REVIEW_EFFECT_CATALOG.length;
