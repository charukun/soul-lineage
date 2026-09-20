import {defs} from '@soul/world/mura';

const PROP_IDS=Object.freeze([
  'fence','wall','tree','pine','flowers','hedge','lamp','bench',
  'bed','sofa','table','chair','shelf','counter','workbench','hearth','rug','plant',
]);
const thumb=id=>`/review/object-thumbnails.svg#${id}`;

export const RINNE_OBJECT_REVIEW_CATALOG=Object.freeze([
  {id:'barrel',label:'樽',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/barrel_small.gltf.glb',thumbnailUrl:thumb('barrel'),source:'KayKit Dungeon Remastered'},
  {id:'box',label:'木箱',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/box_small.gltf.glb',thumbnailUrl:thumb('box'),source:'KayKit Dungeon Remastered'},
  {id:'rubble',label:'瓦礫',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/rubble_large.gltf.glb',thumbnailUrl:thumb('rubble'),source:'KayKit Dungeon Remastered'},
  {id:'torch',label:'松明',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/torch_lit.gltf.glb',thumbnailUrl:thumb('torch'),source:'KayKit Dungeon Remastered'},
  ...RINNE_KENNEY_OBJECTS.map(item=>Object.freeze({
    id:item.id,label:item.label,category:item.category,kind:'gltf',
    url:libraryUrl(item.runtimeAssetPath),thumbnailUrl:thumb(item.thumbnail),
    source:'Kenney · CC0 · '+item.pack,
  })),
  ...PROP_IDS.map(id=>({id:`prop-${id}`,label:defs[id]?.label||id,category:['bed','sofa','table','chair','shelf','counter','workbench','hearth','rug','plant'].includes(id)?'furniture':'outdoor',kind:'prop',propKind:id,thumbnailUrl:thumb(`prop-${id}`),source:'RINNE shared world runtime'})),
  {id:'training-dummy',label:'訓練かかし',category:'training',kind:'runtime',runtimeKind:'training-dummy',thumbnailUrl:thumb('training-dummy'),source:'RINNE gameplay runtime'},
  {id:'armor-stand',label:'防具立て',category:'training',kind:'runtime',runtimeKind:'armor-stand',thumbnailUrl:thumb('armor-stand'),source:'RINNE gameplay runtime'},
  {id:'weapon-spear',label:'槍',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'spear',thumbnailUrl:thumb('weapon-spear'),source:'RINNE gameplay runtime'},
  {id:'weapon-axe',label:'戦斧',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'axe',thumbnailUrl:thumb('weapon-axe'),source:'RINNE gameplay runtime'},
  {id:'weapon-great',label:'大剣',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'great',thumbnailUrl:thumb('weapon-great'),source:'RINNE gameplay runtime'},
]);
