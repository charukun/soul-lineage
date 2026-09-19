import {defs} from '@soul/world/mura';

const PROP_IDS=Object.freeze([
  'fence','wall','tree','pine','flowers','hedge','lamp','bench',
  'bed','sofa','table','chair','shelf','counter','workbench','hearth','rug','plant',
]);

export const RINNE_OBJECT_REVIEW_CATALOG=Object.freeze([
  {id:'barrel',label:'樽',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/barrel_small.gltf.glb',source:'KayKit Dungeon Remastered'},
  {id:'box',label:'木箱',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/box_small.gltf.glb',source:'KayKit Dungeon Remastered'},
  {id:'rubble',label:'瓦礫',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/rubble_large.gltf.glb',source:'KayKit Dungeon Remastered'},
  {id:'torch',label:'松明',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/torch_lit.gltf.glb',source:'KayKit Dungeon Remastered'},
  ...PROP_IDS.map(id=>({id:`prop-${id}`,label:defs[id]?.label||id,kind:'prop',propKind:id,source:'RINNE shared world runtime'})),
  {id:'training-dummy',label:'訓練かかし',kind:'runtime',runtimeKind:'training-dummy',source:'RINNE gameplay runtime'},
  {id:'armor-stand',label:'防具立て',kind:'runtime',runtimeKind:'armor-stand',source:'RINNE gameplay runtime'},
  {id:'weapon-spear',label:'槍',kind:'runtime',runtimeKind:'weapon',weapon:'spear',source:'RINNE gameplay runtime'},
  {id:'weapon-axe',label:'戦斧',kind:'runtime',runtimeKind:'weapon',weapon:'axe',source:'RINNE gameplay runtime'},
  {id:'weapon-great',label:'大剣',kind:'runtime',runtimeKind:'weapon',weapon:'great',source:'RINNE gameplay runtime'},
]);
