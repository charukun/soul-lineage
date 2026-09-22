import {assertSprite25dManifest,DIRECTIONS,resolveSprite25dFrame} from '../../sprite25d-manifest.js';
import {loadSpriteImage,spriteAssetBlob} from '../browser/sprite25d-assets.js';

// THREE is supplied by the host: review and RINNE use the same player without app imports.
export async function createSprite25dActor(THREE,bundle,{shadow=false}={}){
  assertSprite25dManifest(bundle);
  const textures=new Map(),used=new Set([bundle.pose].filter(Boolean));
  for(const clips of Object.values(bundle.animations))for(const clip of Object.values(clips))if(clip)used.add(clip.asset);
  if(!used.size)throw new Error('bundleに透過キャラ画像またはスプライトがありません');
  try{for(const hash of used){const image=await loadSpriteImage(spriteAssetBlob(bundle.assets[hash])),texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;textures.set(hash,texture);}}
  catch(error){for(const texture of textures.values())texture.dispose();throw error;}
  const object=new THREE.Group();object.name='Shino25dLocalDraft';
  const material=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.035,depthTest:true,depthWrite:true,side:THREE.DoubleSide,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);object.add(mesh);
  let contact=null;
  if(shadow){contact=new THREE.Mesh(new THREE.CircleGeometry(.3,24),new THREE.MeshBasicMaterial({color:0x050706,transparent:true,opacity:.28,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.scale.y=.6;contact.position.y=.012;object.add(contact);}
  const point=new THREE.Vector3();let time=0,key='',disposed=false,previewAction=null,previewDirection=null,status='未登録';
  const update=({camera,delta=0,yaw=0,moving=false,billboard=true}={})=>{
    if(disposed||!camera)return;
    object.getWorldPosition(point);
    const angle=Math.atan2(camera.position.x-point.x,camera.position.z-point.z),relative=((angle-yaw)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    const direction=previewDirection||DIRECTIONS[Math.round(relative/(Math.PI/4))%8],action=previewAction||(moving?'walk':'idle');
    const clip=resolveSprite25dFrame(bundle,action,direction),nextKey=`${action}:${direction}:${clip?.asset||''}`;
    if(key!==nextKey){key=nextKey;time=0;}else time+=Math.min(.1,Math.max(0,Number(delta)||0));
    object.rotation.y=billboard?angle:yaw;mesh.visible=Boolean(clip);if(contact)contact.visible=mesh.visible;
    status=clip?(clip.fallback?`${action}/${direction} 未登録 · 静止画で仮表示`:`${action}/${direction} · ${clip.columns} frames`):`${action}/${direction} 未登録`;
    if(!clip)return;
    const asset=bundle.assets[clip.asset],texture=textures.get(clip.asset),cellW=asset.width/clip.columns,cellH=asset.height/clip.rows,frame=Math.floor(time*clip.fps)%clip.columns;
    texture.repeat.set((cellW-1)/asset.width,(cellH-1)/asset.height);texture.offset.set((frame*cellW+.5)/asset.width,1-((clip.row+1)*cellH-.5)/asset.height);
    if(material.map!==texture){material.map=texture;material.needsUpdate=true;}
    const height=bundle.render.height,width=height*cellW/cellH;mesh.scale.set(width,height,1);
    mesh.position.set((.5-bundle.render.pivot[0])*width,(bundle.render.pivot[1]-.5)*height,0);
  };
  return {object,update,getStatus:()=>status,
    setPreview(action=null,direction=null){previewAction=action;previewDirection=direction;},
    setOpacity(value){material.opacity=Math.min(1,Math.max(0,value));},
    dispose(){if(disposed)return;disposed=true;object.removeFromParent();mesh.geometry.dispose();material.dispose();contact?.geometry.dispose();contact?.material.dispose();for(const texture of textures.values())texture.dispose();textures.clear();}};
}
