import { REVIEW_KAYKIT_EQUIPMENT, REVIEW_KAYKIT_EQUIPMENT_SOURCE, REVIEW_KAYKIT_SKELETON_SOURCE } from '@soul/assets/review-catalog';

export const EQUIPMENT_REFERENCE = Object.freeze({
  geometry: REVIEW_KAYKIT_EQUIPMENT_SOURCE,
  skeletonGeometry: REVIEW_KAYKIT_SKELETON_SOURCE,
  attachmentRepository: 'levy-street/world-of-claudecraft',
  attachmentCommit: '83347159f70103c887768fc0aa0e6aff0d030e8d',
  attachmentLicense: 'MIT',
});

const LABELS = Object.freeze({
  'sword-1h':'片手剣','sword-2h':'両手剣','sword-2h-color':'両手剣・彩色',
  'axe-1h':'片手斧','axe-2h':'両手斧','dagger':'短剣','staff':'杖','wand':'ワンド',
  'crossbow-1h':'片手クロスボウ','crossbow-2h':'両手クロスボウ',
  'shield-round':'丸盾','shield-round-barbarian':'蛮族の丸盾','shield-round-color':'丸盾・彩色',
  'shield-square':'角盾','shield-square-color':'角盾・彩色','shield-badge':'紋章盾','shield-badge-color':'紋章盾・彩色',
  'shield-spikes':'棘盾','shield-spikes-color':'棘盾・彩色','quiver':'矢筒',
  'spellbook-closed':'魔導書・閉','spellbook-open':'魔導書・開','smokebomb':'煙玉','mug-empty':'空のマグ','mug-full':'飲み物入りマグ',
  'skeleton-blade':'骨剣','skeleton-axe':'骨斧','skeleton-staff':'骨杖','skeleton-crossbow':'骨クロスボウ',
  'skeleton-shield-large-a':'骨大盾 A','skeleton-shield-large-b':'骨大盾 B',
  'skeleton-shield-small-a':'骨小盾 A','skeleton-shield-small-b':'骨小盾 B','skeleton-quiver':'骨矢筒',
});

export const EQUIPMENT_CATALOG = Object.freeze(REVIEW_KAYKIT_EQUIPMENT.map(row => Object.freeze({
  ...row,
  label: LABELS[row.id] || row.id,
  url: `./${row.publicPath}`,
})));
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT_CATALOG.map(row => [row.id,row]));
export const equipmentForSlot = slot => EQUIPMENT_CATALOG.filter(row => row.slots.includes(slot));

// Cross-checked against the authored KayKit accessory nodes and fallback table
// in world-of-claudecraft@8334715 (MIT). KayKit models prefer their own native
// accessory-node transform at runtime; these rows are the verified fallback.
export const KAYKIT_HAND_GRIPS = Object.freeze({
  '1H_Axe': Object.freeze({
    r:Object.freeze({position:[0.231697,0.382471,0],quaternion:[0,1,0,0],scale:0.622211}),
    l:Object.freeze({position:[-0.231697,0.382471,0],quaternion:[0,0,0,1],scale:0.622211}),
  }),
  '2H_Axe': Object.freeze({r:Object.freeze({position:[0,0.4626,0],quaternion:[0,1,0,0],scale:0.8623})}),
  '1H_Crossbow': Object.freeze({r:Object.freeze({position:[0.2286,0.0213,-0.0012],quaternion:[0,Math.SQRT1_2,0,Math.SQRT1_2],scale:0.6109})}),
  '2H_Crossbow': Object.freeze({r:Object.freeze({position:[0.3381,0.058,0],quaternion:[0,Math.SQRT1_2,0,Math.SQRT1_2],scale:0.7204})}),
  '1H_Sword': Object.freeze({
    r:Object.freeze({position:[0,0.555174,0],quaternion:[0,1,0,0],scale:0.8876}),
    l:Object.freeze({position:[0,0.555174,0],quaternion:[0,0,0,1],scale:0.8876}),
  }),
  '2H_Sword': Object.freeze({r:Object.freeze({position:[0,0.8148,0],quaternion:[0,1,0,0],scale:1.1829})}),
  '2H_Staff': Object.freeze({r:Object.freeze({position:[-0.0427,0.1769,0],quaternion:[0,1,0,0],scale:1.0773})}),
  Knife: Object.freeze({
    r:Object.freeze({position:[-0.0095,0.378,0],quaternion:[0,1,0,0],scale:0.6029}),
    l:Object.freeze({position:[0.0095,0.378,0],quaternion:[0,0,0,1],scale:0.6029}),
  }),
  '1H_Wand': Object.freeze({r:Object.freeze({position:[0,0.2174,0],quaternion:[0,1,0,0],scale:0.4831})}),
  Round_Shield: Object.freeze({
    r:Object.freeze({position:[0,0.017,0.1771],quaternion:[0,1,0,0],scale:0.4413}),
    l:Object.freeze({position:[0,0.017,0.1771],quaternion:[0,0,0,1],scale:0.4413}),
  }),
  Rectangle_Shield: Object.freeze({
    r:Object.freeze({position:[0,0.017,0.1617],quaternion:[0,1,0,0],scale:0.5964}),
    l:Object.freeze({position:[0,0.017,0.1617],quaternion:[0,0,0,1],scale:0.5964}),
  }),
  Badge_Shield: Object.freeze({
    r:Object.freeze({position:[0,-0.0123,0.1341],quaternion:[0,1,0,0],scale:0.5108}),
    l:Object.freeze({position:[0,-0.0123,0.1341],quaternion:[0,0,0,1],scale:0.5108}),
  }),
});

const qEuler = ([x,y,z]) => {
  const c1=Math.cos(x/2),s1=Math.sin(x/2),c2=Math.cos(y/2),s2=Math.sin(y/2),c3=Math.cos(z/2),s3=Math.sin(z/2);
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
};
const back = (position,euler) => Object.freeze({position:Object.freeze(position),quaternion:Object.freeze(qEuler(euler))});
export const KAYKIT_BACK_GRIPS = Object.freeze({
  '1H_Sword':back([.16,.14,-.27],[.1,0,Math.PI*.72]),
  '2H_Sword':back([.14,.10,-.30],[.1,0,Math.PI*.75]),
  '1H_Axe':back([.16,.14,-.27],[.1,0,Math.PI*.72]),
  '2H_Axe':back([.14,.10,-.30],[.1,0,Math.PI*.75]),
  '2H_Staff':back([.12,0,-.30],[.1,0,Math.PI*.78]),
  Knife:back([.50,-.38,-.08],[.05,.15,Math.PI*.72]),
  '1H_Wand':back([.50,-.38,-.08],[.05,.15,Math.PI*.72]),
  '1H_Crossbow':back([0,.10,-.30],[0,Math.PI/2,Math.PI]),
  '2H_Crossbow':back([0,.10,-.32],[0,Math.PI/2,Math.PI]),
  Round_Shield:back([0,.24,-.32],[0,Math.PI,0]),
  Rectangle_Shield:back([0,.20,-.32],[0,Math.PI,0]),
  Badge_Shield:back([0,.24,-.32],[0,Math.PI,0]),
  Quiver:back([-.17,-.02,-.28],[.08,0,-.32]),
  Held_Book:back([.36,-.34,-.12],[.05,.15,Math.PI*.72]),
});

export const KAYKIT_ACCESSORY_NODE = Object.freeze({
  '1H_Axe':Object.freeze({r:'1H_Axe',l:'1H_Axe'}),
  '2H_Axe':Object.freeze({r:'2H_Axe'}),
  '1H_Crossbow':Object.freeze({r:'1H_Crossbow'}),
  '2H_Crossbow':Object.freeze({r:'2H_Crossbow'}),
  '1H_Sword':Object.freeze({r:'1H_Sword',l:'1H_Sword_Offhand'}),
  '2H_Sword':Object.freeze({r:'2H_Sword'}),
  '2H_Staff':Object.freeze({r:'2H_Staff'}),
  Knife:Object.freeze({r:'Knife',l:'Knife_Offhand'}),
  '1H_Wand':Object.freeze({r:'1H_Wand'}),
  Round_Shield:Object.freeze({r:'Round_Shield',l:'Round_Shield'}),
  Rectangle_Shield:Object.freeze({r:'Rectangle_Shield',l:'Rectangle_Shield'}),
  Badge_Shield:Object.freeze({r:'Badge_Shield',l:'Badge_Shield'}),
});
