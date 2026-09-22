import {CURATED_REVIEW_OBJECTS} from '../shared/curated-library.js';
import {defs} from '@soul/world/mura';
import {EXPERIMENTAL_GENERATED_ASSETS,projectAssetUrl} from '@soul/assets';
import {RINNE_KENNEY_EXPANSION_OBJECTS} from '../shared/kenney-library.js';

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

const generatedExperimental=item=>Object.freeze({
  id:item.id,label:item.label,category:'props',kind:'gltf',
  url:libraryUrl(item.runtimePath),thumbnailImageUrl:libraryUrl(item.thumbnailPath),
  source:`Hi3DGen · experimental · ${item.model}`,experimentalGenerated:true,
  provenance:Object.freeze({
    repository:'Stable-X/Hi3DGen',revision:item.sourceRevision,path:item.provenancePath,
    gitBlobSha:item.gitBlobSha,byteLength:item.byteLength,license:item.license,
    triangles:item.inspection?.triangles,sha256:item.sha256,
  }),
});

const kenneyMedieval=(id,label,category,thumbnail,sourcePath,gitBlobSha,byteLength)=>Object.freeze({
  id:`kenney-${id}`,label,category,kind:'gltf',
  url:libraryUrl(`object/kenney-medieval/${id}/${gitBlobSha}.glb`),
  thumbnailUrl:thumb(thumbnail),
  source:'Kenney · CC0-1.0',
  provenance:Object.freeze({repository:'eturner58/game-assets',revision:'fc2cd355a8e7c1d8e625fd650abf64f50a1fddaa',path:sourcePath,gitBlobSha,byteLength,author:'Kenney',license:'CC0-1.0',originalSource:'https://kenney.nl'}),
});

export const RINNE_OBJECT_REVIEW_CATALOG=Object.freeze([
  ...EXPERIMENTAL_GENERATED_ASSETS.map(generatedExperimental),
  ...CURATED_REVIEW_OBJECTS,
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
  kenneyMedieval('fantasy-cart','荷車','outdoor','box',"kenney/3D assets/Fantasy Town Kit/Models/GLB format/cart.glb",'451704fa87c984d6cbf49c93ee4b9d76b85b0ece',52920),
  kenneyMedieval('fantasy-fence-gate','木柵門','outdoor','prop-fence',"kenney/3D assets/Fantasy Town Kit/Models/GLB format/fence-gate.glb",'cfec842b308170ed26331bb38a70030043736c6a',46340),
  kenneyMedieval('fantasy-fountain','石造噴水','outdoor','rubble',"kenney/3D assets/Fantasy Town Kit/Models/GLB format/fountain-round-detail.glb",'c9a5f98f07a543c98e21d624a6c23938acecbfb5',136888),
  kenneyMedieval('fantasy-lantern','街灯ランタン','outdoor','prop-lamp',"kenney/3D assets/Fantasy Town Kit/Models/GLB format/lantern.glb",'fad3ef7051d795d2a25f6aefbd68b374d31544ba',14984),
  kenneyMedieval('fantasy-stall-red','赤布市場屋台','outdoor','prop-counter',"kenney/3D assets/Fantasy Town Kit/Models/GLB format/stall-red.glb",'8c42e92b7cde4416a9abad62aaca126b3115be4c',24304),
  kenneyMedieval('fantasy-windmill','風車','outdoor','prop-wall',"kenney/3D assets/Fantasy Town Kit/Models/GLB format/windmill.glb",'025c102b2b05ef840a86de2a9e9b2c05565bf57d',71160),
  kenneyMedieval('retro-barrels','樽積み','props','barrel',"kenney/3D assets/Retro Fantasy Kit/Models/GLB format/barrels.glb",'08d0e7c637f2a9c5dd52e42b3255bd70b8ebb3ab',63196),
  kenneyMedieval('retro-tower-top','石塔上部','outdoor','rubble',"kenney/3D assets/Retro Fantasy Kit/Models/GLB format/tower-top.glb",'0088f141cd549677c3323d6ff6814d21300cc459',35704),
  kenneyMedieval('retro-wall-door','石壁扉','outdoor','prop-wall',"kenney/3D assets/Retro Fantasy Kit/Models/GLB format/wall-door.glb",'35466be3a3b655186b7c0c31abb9e0c08e6045e0',7508),
  kenneyMedieval('retro-fortified-gate','城塞門','outdoor','prop-wall',"kenney/3D assets/Retro Fantasy Kit/Models/GLB format/wall-fortified-gate.glb",'ea78faada9e07470a29a1914d66a6674629ddce6',17224),
  kenneyMedieval('retro-stairs-stone','石階段','outdoor','rubble',"kenney/3D assets/Retro Fantasy Kit/Models/GLB format/stairs-stone.glb",'0ea750ccf55605b3a11c8a8958858ea34116c936',20312),
  kenneyMedieval('dungeon-chest','地下宝箱','props','box',"kenney/3D assets/Mini Dungeon/Models/GLB format/chest.glb",'89faa6abb930cc0eff458c6ece787302e86c23ce',34048),
  kenneyMedieval('dungeon-gate','地下格子門','outdoor','prop-wall',"kenney/3D assets/Mini Dungeon/Models/GLB format/gate.glb",'a22fbeaa626b950fb67715bd73f6a968f4385b48',14152),
  kenneyMedieval('dungeon-trap','床罠','training','training-dummy',"kenney/3D assets/Mini Dungeon/Models/GLB format/trap.glb",'16d11e3c7395a22cc0cb89f2b351cb708739a2b3',42944),
  kenneyMedieval('forest-tree','森の木','outdoor','prop-tree',"kenney/3D assets/Mini Forest/Models/GLB format/tree.glb",'a8d0e5619df6c6239371e668bad72ac0c4c942fc',23476),
  kenneyMedieval('forest-rocks-high','岩場','outdoor','rubble',"kenney/3D assets/Mini Forest/Models/GLB format/rocks-high.glb",'e4b3bdc3b4cbd421b9773d73fc0918778804212d',31952),
  kenneyMedieval('forest-target','弓術標的','training','training-dummy',"kenney/3D assets/Mini Forest/Models/GLB format/target.glb",'ac46cfc19b86dcd2cc5515a6086c6d0eeb06a77f',17696),
  kenneyMedieval('survival-campfire','焚き火台','outdoor','prop-hearth',"kenney/3D assets/Survival Kit/Models/GLB format/campfire-pit.glb",'3de2a644a0cfb8ea16856acddf6c35dcf6604e29',26468),
  kenneyMedieval('survival-workbench','野外作業台','furniture','prop-workbench',"kenney/3D assets/Survival Kit/Models/GLB format/workbench.glb",'5880286dc96366f2dd43563ee24aa7ee16aa5b03',26104),
  kenneyMedieval('survival-axe','手斧','weapons','weapon-axe',"kenney/3D assets/Survival Kit/Models/GLB format/tool-axe.glb",'11fe453456faa24fbe888313cbb9521f4596a630',8612),
  kenneyMedieval('grave-crypt','石造納骨堂','outdoor','rubble',"kenney/3D assets/Graveyard Kit/Models/GLB format/crypt-large.glb",'92fd30a7905215b57875dc313e6536db31a8642b',54852),
  kenneyMedieval('grave-cross','十字墓石','outdoor','rubble',"kenney/3D assets/Graveyard Kit/Models/GLB format/gravestone-cross.glb",'fac50d452f147808f5535a71e3dfbdae886c6810',20584),
  kenneyMedieval('grave-candles','墓所の燭台','props','torch',"kenney/3D assets/Graveyard Kit/Models/GLB format/candle-multiple.glb",'5c88d9450c86ceb61d4ecdbd2d11f2f5427fbf6c',17304),
  ...RINNE_KENNEY_EXPANSION_OBJECTS.map(item=>Object.freeze({
    id:item.id,label:item.label,category:item.category,kind:'gltf',
    url:libraryUrl(item.runtimeAssetPath),thumbnailUrl:thumb(item.thumbnail),
    source:'Kenney · CC0-1.0 · '+item.pack,
    provenance:Object.freeze({repository:'eturner58/game-assets',revision:'fc2cd355a8e7c1d8e625fd650abf64f50a1fddaa',gitBlobSha:item.gitBlobSha,author:'Kenney',license:'CC0-1.0'}),
  })),
  ...PROP_IDS.map(id=>({id:`prop-${id}`,label:defs[id]?.label||id,category:['bed','sofa','table','chair','shelf','counter','workbench','hearth','rug','plant'].includes(id)?'furniture':'outdoor',kind:'prop',propKind:id,thumbnailUrl:thumb(`prop-${id}`),source:'RINNE shared world runtime'})),
  {id:'training-dummy',label:'訓練かかし',category:'training',kind:'runtime',runtimeKind:'training-dummy',thumbnailUrl:thumb('training-dummy'),source:'RINNE gameplay runtime'},
  {id:'armor-stand',label:'防具立て',category:'training',kind:'runtime',runtimeKind:'armor-stand',thumbnailUrl:thumb('armor-stand'),source:'RINNE gameplay runtime'},
  {id:'weapon-spear',label:'槍',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'spear',thumbnailUrl:thumb('weapon-spear'),source:'RINNE gameplay runtime'},
  {id:'weapon-axe',label:'戦斧',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'axe',thumbnailUrl:thumb('weapon-axe'),source:'RINNE gameplay runtime'},
  {id:'weapon-great',label:'大剣',category:'weapons',kind:'runtime',runtimeKind:'weapon',weapon:'great',thumbnailUrl:thumb('weapon-great'),source:'RINNE gameplay runtime'},
]);
