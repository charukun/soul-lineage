import {GARDEN,FURNITURE} from '@soul/world/mura';

const uniqueById=items=>Array.from(new Map(items.map(item=>[item.id,item])).values());

export const RINNE_OBJECT_REVIEW_CATALOG=Object.freeze([
  {id:'barrel',label:'樽',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/barrel_small.gltf.glb',source:'KayKit Dungeon Remastered'},
  {id:'box',label:'木箱',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/box_small.gltf.glb',source:'KayKit Dungeon Remastered'},
  {id:'rubble',label:'瓦礫',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/rubble_large.gltf.glb',source:'KayKit Dungeon Remastered'},
  {id:'torch',label:'松明',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/torch_lit.gltf.glb',source:'KayKit Dungeon Remastered'},
  ...uniqueById([...GARDEN,...FURNITURE]).map(item=>({id:`prop-${item.id}`,label:item.label,kind:'prop',propKind:item.id,source:'RINNE shared world runtime'})),
  {id:'training-dummy',label:'訓練かかし',kind:'runtime',runtimeKind:'training-dummy',source:'RINNE gameplay runtime'},
  {id:'armor-stand',label:'防具立て',kind:'runtime',runtimeKind:'armor-stand',source:'RINNE gameplay runtime'},
  {id:'weapon-spear',label:'槍',kind:'runtime',runtimeKind:'weapon',weapon:'spear',source:'RINNE gameplay runtime'},
  {id:'weapon-axe',label:'戦斧',kind:'runtime',runtimeKind:'weapon',weapon:'axe',source:'RINNE gameplay runtime'},
  {id:'weapon-great',label:'大剣',kind:'runtime',runtimeKind:'weapon',weapon:'great',source:'RINNE gameplay runtime'},
]);
