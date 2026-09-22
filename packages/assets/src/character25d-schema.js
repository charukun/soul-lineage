import {SPRITE25D_SCHEMA,SHINO_ID,createShinoDraft,assertSprite25dManifest} from './sprite25d-manifest.js';
import {createHumanoidRig,RIG_VERSION,LAYER_NAMES} from './character25d-rig.js';
export const CHARACTER25D_SCHEMA='rinne.character25d/v2';
export const APPEARANCE_VIEWS=Object.freeze(['front','frontQuarter','side','backQuarter','back']);
export const CHARACTER25D_ACTIONS=Object.freeze(['idle','walk','run','turn','attack','hit','talk','pickup','rest']);
export const MOTION_LIBRARY='rinne.character25d.humanoid/v1';
export function createCharacter25DDraft({id='character.local',name='新しいキャラクター'}={}) {
  const draft=createShinoDraft();
  return {...draft,schema:CHARACTER25D_SCHEMA,id,name,
    appearance:Object.fromEntries(APPEARANCE_VIEWS.map(view=>[view,null])),
    rig:createHumanoidRig(),layers:LAYER_NAMES.map(name=>({name,method:'silhouette-influence-grid/v1'})),
    motion:{library:MOTION_LIBRARY,actions:[...CHARACTER25D_ACTIONS]},
    secondaryMotion:{hair:{stiffness:48,damping:12,limit:.075},clothing:{stiffness:65,damping:14,limit:.055},accessories:{stiffness:38,damping:11,limit:.085}},
    gameplayProxy:{shape:'capsule',radius:.24,height:1.72,maxSlope:Math.PI/4,maxStep:.22,interactionDistance:1.65,
      sockets:{interaction:'chest',handL:'hand.L',handR:'hand.R',weapon:'hand.R',hitbox:'hand.R',hurtbox:'chest'}},
    provenance:{sourceSha256:null,sourceDimensions:null,derived:true,generated:false,compiler:'one-image-humanoid/v1',author:'user-supplied-unverified',license:'unverified'},
    compatibility:null};
}

// Reuse v1's strict raster/lineage/approval gates, without inheriting its identity.
export function character25dRasterEnvelope(bundle) {
  return {...bundle,schema:SPRITE25D_SCHEMA,id:SHINO_ID,name:'しのちゃん'};
}
export function assertCharacter25D(bundle) {
  if(bundle?.schema===SPRITE25D_SCHEMA)return assertSprite25dManifest(bundle);
  const fail=message=>{throw new Error('Character25D: '+message);};
  if(bundle?.schema!==CHARACTER25D_SCHEMA)fail('未対応のschemaです');
  if(typeof bundle.id!=='string'||!/^[\w.:-]{1,100}$/.test(bundle.id)||typeof bundle.name!=='string'||!bundle.name.trim()||bundle.name.length>100)fail('id/nameが不正です');
  assertSprite25dManifest(character25dRasterEnvelope(bundle));
  const finite=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
  if(!bundle.rig||bundle.rig.version!==RIG_VERSION||!Array.isArray(bundle.rig.bones))fail('骨格がありません');
  const expected=createHumanoidRig().bones;
  if(bundle.rig.bones.length!==expected.length)fail('骨の数が不正です');
  bundle.rig.bones.forEach((bone,index)=>{
    if(bone.name!==expected[index].name||bone.parent!==expected[index].parent||!Array.isArray(bone.rest)||bone.rest.length!==3||bone.rest.some(n=>!finite(n,-1.5,1.5)))fail('骨の順序・親子関係・接地点が不正です');
  });
  for(const [key,lo,hi] of [['head',.72,.84],['shoulder',.61,.72],['hip',.36,.49],['width',.18,.32]])if(!finite(bundle.rig.proportions?.[key],lo,hi))fail('比率が不正です');
  if(!Array.isArray(bundle.layers)||bundle.layers.length!==LAYER_NAMES.length||bundle.layers.some((l,i)=>l.name!==LAYER_NAMES[i]||l.method!=='silhouette-influence-grid/v1'))fail('layer定義が不正です');
  if(!bundle.appearance||Object.keys(bundle.appearance).length!==APPEARANCE_VIEWS.length||APPEARANCE_VIEWS.some(v=>!Object.hasOwn(bundle.appearance,v)))fail('view枠が不足しています');
  const hashes=new Set();
  for(const key of APPEARANCE_VIEWS) {
    const view=bundle.appearance[key];if(view===null)continue;
    const asset=bundle.assets[view.asset],b=view.bounds;
    if(!asset?.hasTransparency||!Array.isArray(b)||b.length!==4||b.some(n=>!Number.isInteger(n))||b[0]<0||b[1]<0||b[2]>asset.width||b[3]>asset.height||b[2]-b[0]<4||b[3]-b[1]<8||view.mirror!==false||!['unknown','left','right'].includes(view.side)||!['detected-candidate','user-associated','legacy-pose'].includes(view.status))fail('viewの素材・輪郭・向きが不正です');
    hashes.add(view.asset);
  }
  if([...hashes].reduce((n,h)=>n+bundle.assets[h].width*bundle.assets[h].height,0)>8388608)fail('表示用画像は合計8Mピクセル以下にしてください');
  if(bundle.pose&&!bundle.appearance.front)fail('frontがありません');
  if(bundle.motion?.library!==MOTION_LIBRARY||JSON.stringify(bundle.motion.actions)!==JSON.stringify(CHARACTER25D_ACTIONS))fail('motion libraryが不正です');
  for(const key of ['hair','clothing','accessories']) {
    const s=bundle.secondaryMotion?.[key];if(!s||!finite(s.stiffness,1,100)||!finite(s.damping,2,30)||!finite(s.limit,0,.12))fail('springが不正です');
  }
  const p=bundle.gameplayProxy;
  if(!p||p.shape!=='capsule'||!finite(p.radius,.05,.6)||!finite(p.height,.3,3)||p.height<p.radius*2||!finite(p.maxSlope,0,Math.PI/3)||!finite(p.maxStep,0,.4)||!finite(p.interactionDistance,.3,3))fail('proxyが不正です');
  for(const key of ['interaction','handL','handR','weapon','hitbox','hurtbox'])if(!expected.some(b=>b.name===p.sockets?.[key]))fail('socketが不正です');
  const provenance=bundle.provenance;
  if(!provenance||provenance.derived!==true||provenance.generated!==false||provenance.author!=='user-supplied-unverified'||provenance.license!=='unverified'||provenance.compiler!=='one-image-humanoid/v1')fail('provenanceが不正です');
  if(bundle.pose){const source=bundle.assets[provenance.sourceSha256];if(!source||JSON.stringify(provenance.sourceDimensions)!==JSON.stringify([source.width,source.height]))fail('正本画像のhash/dimensionsが不正です');}
  return bundle;
}

// Synchronous metadata migration; browser compiler supplies alpha-derived bounds.
// v1 atlases are retained byte-for-byte and stay playable through the v1 adapter.
export function migrateCharacter25D(value,{bounds}={}) {
  if(value?.schema===CHARACTER25D_SCHEMA)return structuredClone(assertCharacter25D(value));
  assertSprite25dManifest(value);
  const out={...createCharacter25DDraft({id:value.id,name:value.name}),...structuredClone(value),schema:CHARACTER25D_SCHEMA};
  Object.assign(out,{
    ...Object.fromEntries(['appearance','rig','layers','motion','secondaryMotion','gameplayProxy','provenance'].map(key=>[key,createCharacter25DDraft()[key]])),
    compatibility:{schema:value.schema,mode:'retained-v1-atlas',pose:value.pose,animations:structuredClone(value.animations)}});
  out.gameplayProxy.height=value.render.height;
  if(value.pose){const a=value.assets[value.pose];out.appearance.front={asset:value.pose,bounds:bounds||[0,0,a.width,a.height],side:'unknown',mirror:false,status:'legacy-pose'};}
  let source=value.references.sheet||value.references.front||value.pose;
  while(value.assets[source]?.provenance.parentSha256)source=value.assets[source].provenance.parentSha256;
  if(source){out.provenance.sourceSha256=source;out.provenance.sourceDimensions=[value.assets[source].width,value.assets[source].height];}
  return assertCharacter25D(out);
}
