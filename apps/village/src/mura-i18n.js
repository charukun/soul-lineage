const dictionaries={
 ja:{
  mayorTitle:'村長',musicRoom:'音楽室',language:'言語',japanese:'日本語',english:'English',
  cancel:'キャンセル',done:'完了',rotate:'回転',moveCamera:'配置位置を動かす',eventLog:'記録',villageNow:'村の今',
  activeResidents:'詳細住民',virtualResidents:'簡易住民',population:'人口',season:'季節',weather:'天気',cycle:'六年輪',
  spring:'春',summer:'夏',autumn:'秋',winter:'冬',clear:'晴れ',cloudy:'曇り',rain:'雨',snow:'雪',wind:'風',
  dawnAge:'黎明期',dayAge:'白昼期',duskAge:'黄昏期',
  age:'年齢',lifeStage:'年代',trait:'特徴',carry:'所持重量',carryLimit:'所持上限',status:'状態',job:'仕事',home:'住まい',
  child:'幼年',young:'青年',adult:'壮年',elder:'老年',strong:'力持ち',nimble:'身軽',sturdy:'丈夫',gentle:'穏やか',
  buildingState:'建築状態',construction:'建築中',planned:'資材待ち',built:'完成',eta:'完成目安',workers:'担当住民',residents:'居住者',production:'生産品',consumption:'使用資材',stored:'所持中',material:'建材',rotation:'向き',position:'位置',
  unlimitedStorage:'村全体で共有する無制限の資材庫です。移動しても中身は失われません。',
  storageUnique:'資材置き場は村全体で1つだけです。既存の資材置き場を移動してください。',
  storageFixed:'共有資材庫は削除できません。移動はできます。',
  carryTooHeavy:'この荷物は今の所持上限を超えるため持てませんでした。',
  agingDeath:'{name}は長い生涯を終え、静かに息を引き取りました。',
  virtualArrival:'新しい住民の世帯が村に加わりました。',
  virtualDeath:'高齢の住民 {count}人が生涯を終えました。'
 },
 en:{
  mayorTitle:'Mayor',musicRoom:'Music Room',language:'Language',japanese:'日本語',english:'English',
  cancel:'Cancel',done:'Place',rotate:'Rotate',moveCamera:'Nudge placement',eventLog:'Log',villageNow:'Village Now',
  activeResidents:'Detailed residents',virtualResidents:'LOD residents',population:'Population',season:'Season',weather:'Weather',cycle:'Six-year cycle',
  spring:'Spring',summer:'Summer',autumn:'Autumn',winter:'Winter',clear:'Clear',cloudy:'Cloudy',rain:'Rain',snow:'Snow',wind:'Windy',
  dawnAge:'Dawn Years',dayAge:'High Sun Years',duskAge:'Dusk Years',
  age:'Age',lifeStage:'Life stage',trait:'Trait',carry:'Carried weight',carryLimit:'Carry limit',status:'Status',job:'Work',home:'Home',
  child:'Child',young:'Young',adult:'Adult',elder:'Elder',strong:'Strong',nimble:'Nimble',sturdy:'Sturdy',gentle:'Gentle',
  buildingState:'Construction',construction:'Building',planned:'Waiting for materials',built:'Complete',eta:'ETA',workers:'Assigned residents',residents:'Residents',production:'Produces',consumption:'Consumes',stored:'Stored',material:'Material',rotation:'Facing',position:'Position',
  unlimitedStorage:'This is the village-wide unlimited shared storehouse. Moving it never loses resources.',
  storageUnique:'Only one shared storehouse can exist. Move the existing one instead.',
  storageFixed:'The shared storehouse cannot be deleted. It can be moved.',
  carryTooHeavy:'This item exceeds the resident’s current carrying limit.',
  agingDeath:'{name} reached the end of a long life and passed away peacefully.',
  virtualArrival:'A new resident household joined the village.',
  virtualDeath:'{count} elderly residents reached the end of their lives.'
 }
};
const supported=['ja','en'];
function detect(){
 try{const saved=localStorage.getItem('mura.locale.v1');if(supported.includes(saved))return saved;}catch{}
 return String(navigator.language||'ja').toLowerCase().startsWith('ja')?'ja':'en';
}
let locale=detect();
function format(text,vars={}){return text.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');}
export function t(key,vars){return format(dictionaries[locale]?.[key]??dictionaries.ja[key]??key,vars);}
export function getLocale(){return locale;}
export function setLocale(next){
 if(!supported.includes(next))return locale;
 locale=next;document.documentElement.lang=next;
 try{localStorage.setItem('mura.locale.v1',next);}catch{}
 window.dispatchEvent(new CustomEvent('mura:locale',{detail:{locale:next}}));
 return locale;
}
export function options(){return supported.map(id=>({id,label:dictionaries[id][id==='ja'?'japanese':'english']}));}
export function exposeI18n(){document.documentElement.lang=locale;const api={t,getLocale,setLocale,options,dictionaries};window.__MURA_I18N__=api;return api;}
