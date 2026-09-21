import {REVIEW_SKELETON_EQUIPMENT} from '@soul/assets';
import {KAYKIT_LICENSE,KAYKIT_SOURCE_REPOSITORY,KAYKIT_SOURCE_REVISION} from '@soul/characters';
import {RINNE_OBJECT_REVIEW_CATALOG} from './review-object-catalog.js';

const freeze=value=>Object.freeze(value);
const SKELETON_HAND_GRIPS=freeze({
  '1H_Sword':freeze({position:freeze([0,0,0]),quaternion:freeze([0,1,0,0]),scale:.8876}),
  '1H_Axe':freeze({position:freeze([0,0,0]),quaternion:freeze([0,1,0,0]),scale:.622211}),
  '2H_Staff':freeze({position:freeze([0,0,0]),quaternion:freeze([0,1,0,0]),scale:1.0773}),
  '2H_Crossbow':freeze({position:freeze([0,0,0]),quaternion:freeze([0,Math.SQRT1_2,0,Math.SQRT1_2]),scale:.7204}),
  Round_Shield:freeze({position:freeze([0,.017,.1771]),quaternion:freeze([0,0,0,1]),scale:.4413}),
  Rectangle_Shield:freeze({position:freeze([0,.017,.1617]),quaternion:freeze([0,0,0,1]),scale:.5964}),
});
const KAYKIT_BATTLE_GRIPS=freeze({
  'kaykit-dagger':freeze({rotation:Object.freeze([0,0,-Math.PI/2]),scale:.72}),
  'kaykit-sword-1h':freeze({rotation:Object.freeze([0,0,-Math.PI/2]),scale:.68}),
  'kaykit-shield-badge':freeze({rotation:Object.freeze([Math.PI/2,0,0]),scale:.78}),
});
const GENERIC_HAND_GRIPS=freeze({
  blade:freeze({rotation:freeze([0,0,-Math.PI/2])}),
  axe:freeze({rotation:freeze([0,0,-Math.PI/2])}),
  polearm:freeze({rotation:freeze([0,0,-Math.PI/2])}),
  ranged:freeze({rotation:freeze([0,0,-Math.PI/2])}),
  shield:freeze({rotation:freeze([Math.PI/2,0,0])}),
});
export const REVIEW_EQUIPMENT_CATEGORY_LABELS=freeze({
  all:'すべて',
  recommended:'おすすめ',
  blade:'刀剣',
  axe:'斧',
  polearm:'長柄',
  ranged:'遠距離',
  shield:'盾',
  head:'頭',
  body:'胴',
  arms:'腕',
  legs:'脚',
  back:'背中',
});
export const REVIEW_EQUIPMENT_CATEGORY_ORDER=freeze(['all','recommended','blade','axe','polearm','ranged','shield','head','body','arms','legs','back']);

const skeletonCategory=family=>{
  if(/Sword/i.test(family))return 'blade';
  if(/Axe/i.test(family))return 'axe';
  if(/Staff|Spear/i.test(family))return 'polearm';
  if(/Crossbow|Bow/i.test(family))return 'ranged';
  if(/Shield/i.test(family))return 'shield';
  return 'blade';
};
const targetFraction=(category,id='')=>{
  if(category==='ranged')return .66;
  if(category==='polearm')return /spear/i.test(id)?.92:.84;
  if(category==='shield')return .43;
  if(/dagger/i.test(id))return .30;
  if(/great/i.test(id))return .66;
  if(category==='axe')return .46;
  return .48;
};
const skeletonRows=REVIEW_SKELETON_EQUIPMENT
  .filter(row=>row.id!=='skeleton-quiver'&&(row.slots.includes('main')||/Shield/i.test(row.family)))
  .map(row=>{
    const category=skeletonCategory(row.family),slot=/Shield/i.test(row.family)?'off':'main';
    return freeze({
      id:row.id,label:row.label,category,slot,kind:'gltf',url:row.runtime.url,
      thumbnailUrl:row.thumbnailUrl,source:'KayKit Skeletons · CC0-1.0',
      targetFraction:row.targetFraction||targetFraction(category,row.id),grip:SKELETON_HAND_GRIPS[row.family]||null,
      recommended:['skeleton-blade','skeleton-axe','skeleton-staff','skeleton-crossbow','skeleton-shield-small-a'].includes(row.id),
      provenance:freeze({repository:'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0',revision:'15b62b9bad122f72926c10fb14d622c73819fa54',license:'CC0-1.0'})
    });
  });

const kaykitBattleRows=[
  ['kaykit-dagger','ダガー','blade','main','dagger.gltf','./review/catalog-thumbnails.svg#skeleton-blade',.31,true],
  ['kaykit-sword-1h','片手剣','blade','main','sword_1handed.gltf','./review/catalog-thumbnails.svg#skeleton-blade',.48,true],
  ['kaykit-shield-badge','紋章盾','shield','off','shield_badge.gltf','./review/catalog-thumbnails.svg#skeleton-shield-small-a',.42,true],
].map(([id,label,category,slot,file,thumbnailUrl,fraction,recommended])=>freeze({
  id,label,category,slot,kind:'gltf',url:`./simulator/assets/kaykit/${file}`,thumbnailUrl,
  source:'KayKit Adventurers · CC0-1.0',targetFraction:fraction,recommended,grip:KAYKIT_BATTLE_GRIPS[id]||null,
  provenance:freeze({repository:KAYKIT_SOURCE_REPOSITORY,revision:KAYKIT_SOURCE_REVISION,license:KAYKIT_LICENSE})
}));

const objectCategory=item=>{
  const key=`${item.id} ${item.label} ${item.weapon||''}`;
  if(/crossbow|bow/i.test(key))return 'ranged';
  if(/axe|斧/i.test(key))return 'axe';
  if(/spear|staff|槍|杖/i.test(key))return 'polearm';
  if(/shield|盾/i.test(key))return 'shield';
  return 'blade';
};
const objectRows=RINNE_OBJECT_REVIEW_CATALOG
  .filter(item=>item.category==='weapons')
  .map(item=>{
    const category=objectCategory(item);
    return freeze({
      id:item.id,label:item.label,category,slot:category==='shield'?'off':'main',
      kind:item.kind==='runtime'?'runtime':'gltf',url:item.url||null,weapon:item.weapon||null,
      thumbnailUrl:item.thumbnailUrl||`./review/object-thumbnails.svg#weapon-great`,
      source:item.source,targetFraction:targetFraction(category,item.id),grip:GENERIC_HAND_GRIPS[category]||null,
      recommended:item.kind==='runtime'||/fantasy-town-blade|survival-axe/i.test(item.id),
      provenance:item.provenance||null
    });
  });

const armorRows=[
  ['rinne-iron-helmet','鉄兜','head','helmet','armor-helmet'],
  ['rinne-iron-chestplate','胸甲','body','chestplate','armor-chest'],
  ['rinne-iron-bracers','籠手','arms','bracers','armor-arms'],
  ['rinne-iron-greaves','脚甲','legs','greaves','armor-legs'],
  ['rinne-traveller-mantle','旅人マント','back','mantle','armor-mantle'],
].map(([id,label,category,armor,thumbnail])=>freeze({
  id,label,category,slot:category,kind:'runtime-armor',armor,
  thumbnailUrl:`./review/catalog-thumbnails.svg#${thumbnail}`,
  source:'RINNE runtime wardrobe',recommended:true,
  provenance:freeze({repository:'charukun/soul-lineage',revision:'develop',license:'project-authored'})
}));

const rows=[...skeletonRows,...kaykitBattleRows,...objectRows,...armorRows];
const seen=new Set();
export const RINNE_EQUIPMENT_REVIEW_CATALOG=freeze(rows.filter(row=>{
  if(seen.has(row.id))return false;seen.add(row.id);return true;
}));
export function equipmentReviewItem(id){return RINNE_EQUIPMENT_REVIEW_CATALOG.find(row=>row.id===id)||null;}
export function filterEquipmentReviewCatalog(filter='recommended'){
  if(filter==='all')return RINNE_EQUIPMENT_REVIEW_CATALOG;
  if(filter==='recommended')return RINNE_EQUIPMENT_REVIEW_CATALOG.filter(row=>row.recommended);
  if(!Object.hasOwn(REVIEW_EQUIPMENT_CATEGORY_LABELS,filter))throw new Error('Unknown equipment filter: '+filter);
  return RINNE_EQUIPMENT_REVIEW_CATALOG.filter(row=>row.category===filter);
}
