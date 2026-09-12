import {THREE as T,GLTFLoader} from '@soul/rendering';
import {View} from './web/view.js';

// Visual-only dressing. Existing naturalTrees(), logging, collision and resource rules remain authoritative.
export const NATURE_SOURCE=Object.freeze({
  pack:'Kenney Nature Kit',
  version:'2.1',
  license:'CC0-1.0',
  officialPage:'https://kenney.nl/assets/nature-kit',
  officialArchiveSha256:'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d',
  manifest:'assets/vendor/kenney-nature/MANIFEST.json',
});
const ROOT=`${import.meta.env.BASE_URL}assets/vendor/kenney-nature`;
const loader=new GLTFLoader();
const templates=new Map();
const LAYOUT=Object.freeze([
  ['tree_oak.glb',-66,-55,9.5,.38],
  ['tree_default.glb',71,-43,8.2,-.46],
  ['tree_oak.glb',-73,51,8.8,.74],
  ['tree_default.glb',69,57,7.6,.18],
  ['rock_largeA.glb',-42,68,2.1,.45],
  ['rock_smallA.glb',45,65,1.15,-.28],
  ['sign.glb',24,-59,2.25,.16],
]);

function loadTemplate(file){
  if(!templates.has(file))templates.set(file,loader.loadAsync(`${ROOT}/${file}`).then(gltf=>{
    if(!gltf.scene)throw new Error(`Nature scene missing: ${file}`);
    return gltf.scene;
  }).catch(error=>{templates.delete(file);throw error;}));
  return templates.get(file);
}
function fitHeight(root,targetHeight){
  root.updateMatrixWorld(true);
  const initial=new T.Box3().setFromObject(root),size=initial.getSize(new T.Vector3());
  if(!Number.isFinite(size.y)||size.y<=0)return root;
  root.scale.multiplyScalar(targetHeight/size.y);root.updateMatrixWorld(true);
  const fitted=new T.Box3().setFromObject(root),center=fitted.getCenter(new T.Vector3());
  root.position.x-=center.x;root.position.z-=center.z;root.position.y-=fitted.min.y;
  return root;
}
function prepare(template,file,height){
  const root=fitHeight(template.clone(true),height);root.name=`KenneyNature_${file}`;
  root.userData.visualOnly=true;root.userData.source=NATURE_SOURCE;root.userData.assetUrl=`${ROOT}/${file}`;
  root.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=true;node.frustumCulled=true;}});
  return root;
}
async function install(view,generation){
  const rows=await Promise.allSettled(LAYOUT.map(async([file,x,z,height,yaw])=>{
    const template=await loadTemplate(file),node=prepare(template,file,height);node.position.set(x,0,z);node.rotation.y=yaw;return node;
  }));
  if(view.__naturePassGeneration!==generation||!view.outside?.parent)return;
  view.__natureGroup?.removeFromParent();
  const group=new T.Group();group.name='KenneyNature_VisualDressing';group.userData.visualOnly=true;group.userData.source=NATURE_SOURCE;
  for(const row of rows){if(row.status==='fulfilled')group.add(row.value);else console.warn('[MURAAAAAAA] Nature visual fallback',row.reason);}
  view.__natureGroup=group;view.outside.add(group);view.canvas.dataset.natureAssets=String(group.children.length);view.renderer.shadowMap.needsUpdate=true;
}

// Do not compete with the first village boot. The visual-only GLBs begin only
// after the existing loading overlay has been dismissed, then yield once more
// to the browser before network/decode work starts.
function scheduleInstall(view,generation){
  view.canvas.dataset.natureAssets='pending';
  const start=()=>{
    if(view.__naturePassGeneration!==generation)return;
    const run=()=>void install(view,generation);
    if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:1500});
    else setTimeout(run,0);
  };
  const loading=document.querySelector('#loading');
  if(!loading||loading.hidden){start();return;}
  const observer=new MutationObserver(()=>{
    if(!loading.hidden)return;
    observer.disconnect();start();
  });
  observer.observe(loading,{attributes:true,attributeFilter:['hidden']});
}

const originalMakeTerrain=View.prototype.makeTerrain;
View.prototype.makeTerrain=function makeTerrainWithSourcedNature(...args){
  const result=originalMakeTerrain.apply(this,args);
  this.__naturePassGeneration=(this.__naturePassGeneration||0)+1;
  scheduleInstall(this,this.__naturePassGeneration);
  return result;
};

window.__MURAAAAAAA_NATURE__=Object.freeze({
  source:NATURE_SOURCE,
  root:ROOT,
  layout:LAYOUT,
  mode:'repository-local-visual-only',
  note:'Distant dressing only; gameplay trees, resources and collision remain unchanged. Loads after first boot.',
});
