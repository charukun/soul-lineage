import { Color, DataTexture, EquirectangularReflectionMapping, LinearFilter, RGBAFormat, SRGBColorSpace } from 'three';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

/**
 * Tiny procedural environment map used as a low-cost IBL floor.
 * It adds broad cool-sky / warm-horizon material response without network assets.
 */
export function createStylizedEnvironmentTexture({sky=0x8eabc1,horizon=0xe8c49a,ground=0x5c6655,width=32,height=16}={}){
  const data=new Uint8Array(width*height*4),skyColor=new Color(sky),horizonColor=new Color(horizon),groundColor=new Color(ground),row=new Color();
  for(let y=0;y<height;y++){
    const v=y/Math.max(1,height-1),above=v<.55,t=above?clamp(v/.55,0,1):clamp((v-.55)/.45,0,1);
    row.copy(above?skyColor:horizonColor).lerp(above?horizonColor:groundColor,above?Math.pow(t,.72):Math.pow(t,1.15));
    for(let x=0;x<width;x++){const i=(y*width+x)*4,side=.96+.04*Math.cos(x/width*Math.PI*2);data[i]=Math.round(row.r*255*side);data[i+1]=Math.round(row.g*255*side);data[i+2]=Math.round(row.b*255*side);data[i+3]=255;}
  }
  const texture=new DataTexture(data,width,height,RGBAFormat);texture.colorSpace=SRGBColorSpace;texture.mapping=EquirectangularReflectionMapping;texture.magFilter=texture.minFilter=LinearFilter;texture.needsUpdate=true;texture.userData.soulStylizedEnvironment=true;return texture;
}

export function installStylizedEnvironment(scene,{intensity=.42,...options}={}){
  if(!scene)throw new Error('Stylized environment requires a scene');
  const previous=scene.environment,texture=createStylizedEnvironmentTexture(options);scene.environment=texture;
  if('environmentIntensity' in scene)scene.environmentIntensity=intensity;
  return{texture,snapshot:()=>({installed:true,intensity}),dispose(){if(scene.environment===texture)scene.environment=previous||null;texture.dispose();}};
}

/** Grade Standard/Physical materials without replacing authored maps or colors. */
export function gradeStylizedMaterials(root,{roughnessBias=-.08,metalnessFloor=0,envMapIntensity=.72,bumpScaleFloor=.035}={}){
  const seen=new Set();let materials=0;
  root?.traverse?.(node=>{for(const material of (Array.isArray(node?.material)?node.material:[node?.material]).filter(Boolean)){
    if(seen.has(material)||(!material.isMeshStandardMaterial&&!material.isMeshPhysicalMaterial))continue;seen.add(material);materials++;
    material.roughness=clamp((Number(material.roughness)||.5)+roughnessBias,.18,1);
    material.metalness=clamp(Math.max(Number(material.metalness)||0,metalnessFloor),0,1);
    if('envMapIntensity' in material)material.envMapIntensity=Math.max(Number(material.envMapIntensity)||0,envMapIntensity);
    if(material.bumpMap)material.bumpScale=Math.max(Number(material.bumpScale)||0,bumpScaleFloor);
    material.userData=material.userData||{};material.userData.soulMaterialGrade=true;material.needsUpdate=true;
  }});
  return{materials,envMapIntensity};
}
