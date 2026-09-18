import {DELENDA_XION_YURT_B} from './visual/delenda-xion-yurt-b.js';

const PRODUCTION_ORIGINS=new Set(['artist-authored','rinne-owned-dcc']);
const LEGACY_PROCEDURAL_IDS=new Set(['mura.housing-legacy-procedural.v1']);
const materialized=(entry)=>Object.freeze({status:'MATERIALIZED',...entry,source:Object.freeze(entry.source),runtime:entry.runtime?Object.freeze(entry.runtime):undefined});
export const visualAssetRegistry=Object.freeze({
 'village.yurt.authored-xion.v2':materialized({
   id:'village.yurt.authored-xion.v2',type:'building',origin:'artist-authored',dimensions:Object.freeze([7.663018,6.833062,7.696953]),license:'CC-BY-SA-3.0',
   localPath:'assets/vendor/production/delenda-yurt/xion_house_b.dae',licensePath:'assets/vendor/production/delenda-yurt/Contributors and License.txt',
   attribution:'Delenda Est contributors; Xiongnu/Scythian source lineage adapted from Terra Magna',
   source:{repository:'JustusAvramenko/delenda_est',revision:'7f1ed21fe909f3584b96ddcb874645fe3fe3776e',path:'art/meshes/structural/xion_house_b.dae',hash:'git-blob:6542bdebe40b8d7d7ab29e737300557accaef034'},
   runtime:{format:'compiled-collada',yaw:0,maxHeight:3.6},meshData:DELENDA_XION_YURT_B
 }),
 'mura.kenney-fantasy-town.v1':materialized({id:'mura.kenney-fantasy-town.v1',type:'building-kit',origin:'artist-authored',license:'CC0-1.0',localPath:'packages/rendering/src/mura/asset-data.js',source:{repository:'charukun/soul-lineage',revision:'d23c28671a221a5fc39f81c56af99ea32e6e5beb',path:'packages/rendering/src/mura/asset-data.js',hash:'git-blob:b7ab235f8a6eeb7c7908c8084b6b77a651e1ad9f'}}),
 'mura.housing-legacy-procedural.v1':materialized({id:'mura.housing-legacy-procedural.v1',type:'building-kit',origin:'legacy-procedural',legacy:true,license:'RINNE-OWNED',localPath:'packages/housing/models.js',source:{repository:'charukun/soul-lineage',revision:'d23c28671a221a5fc39f81c56af99ea32e6e5beb',path:'packages/housing/models.js',hash:'git-blob:31bce88aceb9bc26ef62d08e846bb7bdd5beb91a'}})
});
for(const asset of Object.values(visualAssetRegistry)){
 if(asset.status!=='MATERIALIZED'||!asset.license||!asset.localPath||!asset.source?.revision||!asset.source?.path||!asset.source?.hash)throw new Error(`Incomplete production visual asset: ${asset.id}`);
 if(!PRODUCTION_ORIGINS.has(asset.origin)&&!(asset.origin==='legacy-procedural'&&asset.legacy===true&&LEGACY_PROCEDURAL_IDS.has(asset.id)))throw new Error(`Production visual asset must be authored or an explicitly frozen legacy exception: ${asset.id}`);
}
export function visualAssetById(id){const asset=visualAssetRegistry[id];if(!asset)throw new Error(`Unknown production visual asset: ${id}`);return asset;}
export function requireMaterializedVisualAsset(id){const asset=visualAssetById(id);if(asset.status!=='MATERIALIZED')throw new Error(`Production visual asset is not materialized: ${id}`);return asset;}
