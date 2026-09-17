import {REVIEW_AUTHORED_EFFECTS} from './rebuild/authored-effect-manifest.js';

const entry=(id,metadata)=>Object.freeze({id,effect:id,source:REVIEW_AUTHORED_EFFECTS[id].path,...metadata});

export const REVIEW_EFFECT_CATEGORIES=Object.freeze([
  Object.freeze({id:'all',label:'すべて'}),
  Object.freeze({id:'slash',label:'斬撃'}),
  Object.freeze({id:'impact',label:'命中'}),
  Object.freeze({id:'beam',label:'光線・雷'}),
  Object.freeze({id:'burst',label:'爆発'}),
  Object.freeze({id:'elemental',label:'属性'}),
  Object.freeze({id:'finisher',label:'大技'}),
]);

export const REVIEW_EFFECT_SCENARIOS=Object.freeze([
  Object.freeze({id:'forward',label:'前方斬り',attacker:'hero',anchor:'contact',count:1,spacing:.0,scale:1}),
  Object.freeze({id:'sweep',label:'横薙ぎ',attacker:'hero',anchor:'contact',count:1,spacing:.0,scale:1.08,rotationOffset:-.24}),
  Object.freeze({id:'multi',label:'連撃',attacker:'hero',anchor:'contact',count:3,spacing:.42,scale:.9}),
  Object.freeze({id:'incoming',label:'被弾',attacker:'enemy',anchor:'hero',count:1,spacing:0,scale:1}),
  Object.freeze({id:'kyu',label:'急',attacker:'hero',anchor:'enemy',count:2,spacing:.3,scale:1.2}),
  Object.freeze({id:'finisher',label:'大技',attacker:'hero',anchor:'enemy',count:3,spacing:.5,scale:1.38}),
]);

export const REVIEW_EFFECT_CATALOG=Object.freeze([
  entry('slash',{label:'剣閃リボン',category:'slash',author:'Effekseer',use:'通常斬撃 / 追撃',scenario:'sweep',cueScale:1.12,lifetime:.75,color:[255,238,198,255],summary:'武器軌跡を太く残す原本。通常攻撃の輪郭確認向け。'}),
  entry('impact',{label:'Toon Hit',category:'impact',author:'tktk',use:'命中 / 被弾',scenario:'incoming',cueScale:1.08,lifetime:1.2,color:[255,174,116,255],summary:'接触点が一瞬で読めるトゥーン系ヒット。'}),
  entry('finisher',{label:'Light',category:'finisher',author:'tktk',use:'溜め / 急 / 大技',scenario:'finisher',cueScale:1.22,lifetime:1.9,color:[255,236,170,255],summary:'大きな光量と余韻を持つ大技候補。'}),
  entry('laser01',{label:'Laser 01',category:'beam',author:'Effekseer',use:'直線技 / 斬撃補助',scenario:'forward',cueScale:1.0,lifetime:1.35,color:[182,228,255,255],summary:'細身の直線光。方向性と速度感の確認向け。'}),
  entry('laser02',{label:'Laser 02',category:'beam',author:'Effekseer',use:'雷光 / 急 / 必殺',scenario:'kyu',cueScale:1.12,lifetime:1.6,color:[217,236,255,255],summary:'雷・粒子・バーストを重ねた派手な光線原本。'}),
  entry('laser03',{label:'Laser 03',category:'beam',author:'Effekseer',use:'追撃 / 細い閃光',scenario:'multi',cueScale:1.2,lifetime:1.15,color:[198,225,255,255],summary:'軽量な光線。連撃へ重ねた時の密度を比較しやすい。'}),
  entry('fireworks',{label:'Turbulence Fireworks',category:'burst',author:'Effekseer',use:'爆発 / フィニッシュ',scenario:'finisher',cueScale:1.45,lifetime:1.75,color:[255,196,116,255],summary:'散開する粒子の爆発。画面占有の大きい決め技候補。'}),
  entry('toonWater',{label:'Toon Water',category:'elemental',author:'tktk',use:'属性 / 衝撃波 / 大技',scenario:'kyu',cueScale:1.08,lifetime:1.9,color:[135,222,255,255],summary:'水塊・チューブ・衝撃形状を組み合わせた属性系原本。'}),
]);

export function reviewEffectById(id){return REVIEW_EFFECT_CATALOG.find(row=>row.id===id)||REVIEW_EFFECT_CATALOG[0];}
export function reviewScenarioById(id){return REVIEW_EFFECT_SCENARIOS.find(row=>row.id===id)||REVIEW_EFFECT_SCENARIOS[0];}
export function effectsForCategory(category){return category==='all'?REVIEW_EFFECT_CATALOG:REVIEW_EFFECT_CATALOG.filter(row=>row.category===category);}
