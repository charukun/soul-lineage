/** Rendering adapter: age affects the existing VRM, not its licensed source bytes. */
import * as T from '../vendor/three.js';
import {appearanceForAge} from './life-clock.js';
const textureLevels=12;
export function prepareAgeAppearance(c){
 c.ageHeadRest=c.raw.head?.scale.clone();
 c.ageHair=[];
 for(const m of c.materials){
  if(!/hair/i.test(m.name)||!m.map)continue;
  const image=m.map.image;if(!image)continue;
  const w=Math.max(1,Math.min(1024,image.width||512)),h=Math.max(1,Math.round((image.height||512)*w/(image.width||512)));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  try{ctx.drawImage(image,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);const texture=new T.CanvasTexture(canvas);texture.colorSpace=m.map.colorSpace;texture.flipY=m.map.flipY;texture.wrapS=m.map.wrapS;texture.wrapT=m.map.wrapT;texture.repeat.copy(m.map.repeat);texture.offset.copy(m.map.offset);texture.rotation=m.map.rotation;texture.center.copy(m.map.center);texture.anisotropy=2;
   c.ageHair.push({m,original:m.map,shadeOriginal:m.shadeMultiplyTexture,texture,ctx,pixels,level:-1});
  }catch{ /* A texture that is not canvas-readable keeps its original appearance. */ }
 }
}
export function applyAgePosture(c,a,descriptor){
 const p=appearanceForAge(a.lifeAgeYears||0);c.ageAppearance=p;
 // Applied after animation blending and before final sockets/grounding. Never accumulate.
 if(descriptor.type!=='death'&&p.stoop>0){const direction=c.vrm.meta.metaVersion==='1'?1:-1;
  if(c.bones.spine)c.bones.spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),direction*p.stoop*.62));
  if(c.bones.chest)c.bones.chest.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),direction*p.stoop*.38));
  if(c.bones.head)c.bones.head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-direction*p.stoop*.38));
 }
 c.root.updateMatrixWorld(true);return p;
}
export function finishAgeAppearance(c,a){
 const p=c.ageAppearance||appearanceForAge(a.lifeAgeYears||0);
 if(c.raw.head&&c.ageHeadRest)c.raw.head.scale.copy(c.ageHeadRest).multiplyScalar(p.headScale);
 const level=Math.round(p.gray*textureLevels);
 for(const entry of c.ageHair||[]){
  if(entry.level===level)continue;entry.level=level;
  if(level===0){entry.m.map=entry.original;entry.m.shadeMultiplyTexture=entry.shadeOriginal;entry.m.needsUpdate=true;continue;}
  const src=entry.pixels.data,out=entry.ctx.createImageData(entry.pixels.width,entry.pixels.height),dst=out.data,weight=level/textureLevels;
  for(let i=0;i<src.length;i+=4){const lum=.2126*src[i]+.7152*src[i+1]+.0722*src[i+2];const gray=175+.27*lum;dst[i]=src[i]*(1-weight)+gray*weight;dst[i+1]=src[i+1]*(1-weight)+(gray+2)*weight;dst[i+2]=src[i+2]*(1-weight)+(gray+5)*weight;dst[i+3]=src[i+3];}
  entry.ctx.putImageData(out,0,0);entry.texture.needsUpdate=true;entry.m.map=entry.texture;if(entry.shadeOriginal===entry.original)entry.m.shadeMultiplyTexture=entry.texture;entry.m.needsUpdate=true;
 }
 for(const state of c.materialState){if(state.color&&/face.*skin/i.test(state.m.name)){state.m.color.multiply(new T.Color(1-.055*p.skinAge,1-.065*p.skinAge,1-.05*p.skinAge));}}
 c.root.updateMatrixWorld(true);
 // Update skeleton matrices for both the visible mesh and the shadow copy in the same frame.
 for(const proxy of c.shadowMeshes){proxy.matrix.copy(proxy.userData.source.matrixWorld);proxy.matrixWorldNeedsUpdate=true;}
}
export function disposeAgeAppearance(c){for(const e of c.ageHair||[]){e.m.map=e.original;e.m.shadeMultiplyTexture=e.shadeOriginal;e.texture.dispose();}c.ageHair=[];}
