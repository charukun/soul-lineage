import {defs} from '@soul/world/mura';
import {projectAssetUrl} from '@soul/assets';
import {RINNE_KENNEY_OBJECTS} from './review-kenney-library.js';

const runtimeEnvironment=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;
const libraryUrl=path=>projectAssetUrl(path,{environment:runtimeEnvironment});
const PROP_IDS=Object.freeze([
  'fence','wall','tree','pine','flowers','hedge','lamp','bench',
  'bed','sofa','table','chair','shelf','counter','workbench','hearth','rug','plant',
]);
const thumb=id=>`/review/object-thumbnails.svg#${id}`;
const kaykitDungeon=(id,label,file,gitBlobSha,thumbnail='box')=>Object.freeze({
  id,label,category:'props',kind:'gltf',
  url:libraryUrl(`object/kaykit-dungeon/${file}/${gitBlobSha}.glb`),
  thumbnailUrl:thumb(thumbnail),
  source:'KayKit Dungeon Remastered 1.0 · CC0',
});

export const RINNE_OBJECT_REVIEW_CATALOG=Object.freeze([
  {id:'barrel',label:'樽',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/barrel_small.gltf.glb',thumbnailUrl:thumb('barrel'),source:'KayKit Dungeon Remastered'},
  {id:'box',label:'木箱',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/box_small.gltf.glb',thumbnailUrl:thumb('box'),source:'KayKit Dungeon Remastered'},
  {id:'rubble',label:'瓦礫',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/rubble_large.gltf.glb',thumbnailUrl:thumb('rubble'),source:'KayKit Dungeon Remastered'},
  {id:'torch',label:'松明',category:'props',kind:'gltf',url:'/assets/vendor/kaykit-dungeon/torch_lit.gltf.glb',thumbnailUrl:thumb('torch'),source:'KayKit Dungeon Remastered'},
  kaykitDungeon('kaykit-banner-shield-red','赤の盾紋章旗','banner-shield-red','7e81382d8c57efce6fa89a0c8785eab15ab9576b','torch'),
  kaykitDungeon('kaykit-barrel-large-decorated','装飾大樽','barrel-large-decorated','dd8b97dde32e6b1a08b217ef0c640b1d7c93f283','barrel'),
  kaykitDungeon('kaykit-bed-decorated','装飾ベッド','bed-decorated','b7195b9fad17836ed2140f5ae15f45bb118e87e1','prop-bed'),
  kaykitDungeon('kaykit-box-small-decorated','装飾木箱','box-small-decorated','7ce90474db9145edd27aa7a46447cb9812d7ea3b','box'),
  kaykitDungeon('kaykit-candle-triple','三連燭台','candle-triple','c8c7e63300d6b689607be6f13d828348f0ecc2e6','torch'),
  kaykitDungeon('kaykit-chair','木椅子','chair','d714e3eace33b64d3a2190025a57dd9762e50a6f','prop-chair'),
  kaykitDungeon('kaykit-chest','宝箱','chest','534c76a794d4b531a91619871845e92e3ca6e432','box'),
  kaykitDungeon('kaykit-chest-gold','黄金宝箱','chest-gold','8dd05d691d4954009c94b9bb052e56db5c4f3432','box'),
  kaykitDungeon('kaykit-coin-stack-large','コイン大山','coin-stack-large','a806b1238fbd21299a8f2a1a06eab6486dbcaad2','box'),
  kaykitDungeon('kaykit-crates-stacked','積み木箱','crates-stacked','7f273be5ebd143b58135ecc1d061d22a633cad92','box'),
  kaykitDungeon('kaykit-keg-decorated','装飾酒樽','keg-decorated','6420a0e39f8d76005cdbf3471e6de799099937b3','barrel'),
  kaykitDungeon('kaykit-keyring-hanging','吊り鍵束','keyring-hanging','51c110f8f77e4b49b4fb1a856c57cf060d6b9884','box'),
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
