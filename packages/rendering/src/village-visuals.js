import {ACESFilmicToneMapping,Color,DirectionalLight,Fog,HemisphereLight,PCFSoftShadowMap,SRGBColorSpace} from 'three';

export const VILLAGE_VISUAL_PRESETS=Object.freeze({
 villageDay:Object.freeze({background:0xb5d0cf,fog:0xb5d0cf,fogNear:128,fogFar:500,exposure:1.05,hemiSky:0xddeafb,hemiGround:0x758963,hemiIntensity:1.72,key:0xffdfb5,keyIntensity:2.45,fill:0xaec9d6,fillIntensity:.24,rim:0xffc98d,rimIntensity:.20}),
 demonNight:Object.freeze({background:0x070d10,fog:0x111918,fogNear:26,fogFar:118,exposure:.82,hemiSky:0x62716c,hemiGround:0x12100e,hemiIntensity:.55,key:0xb4c4c0,keyIntensity:2.3,fill:0xd89057,fillIntensity:.35,rim:0x5f8290,rimIntensity:.54}),
 lanternNight:Object.freeze({background:0x0a1328,fog:0x14213b,fogNear:24,fogFar:70,exposure:1.02,hemiSky:0x86a4e4,hemiGround:0x273b48,hemiIntensity:.8,key:0x91b8ff,keyIntensity:1.5,fill:0xffb775,fillIntensity:.28,rim:0x9dbbe8,rimIntensity:.45})
});

export function applyVillageVisualPreset({renderer,scene,key=null,hemi=null,preset='villageDay',createFill=true,createRim=true}={}){
 const p=typeof preset==='string'?VILLAGE_VISUAL_PRESETS[preset]:preset;
 if(!renderer||!scene||!p)throw new Error('Village visual preset requires renderer, scene and a valid preset.');
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=p.exposure;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFSoftShadowMap;
 scene.background=new Color(p.background);scene.fog=new Fog(p.fog,p.fogNear,p.fogFar);
 if(!hemi){hemi=new HemisphereLight(p.hemiSky,p.hemiGround,p.hemiIntensity);scene.add(hemi);}else{hemi.color.set(p.hemiSky);hemi.groundColor.set(p.hemiGround);hemi.intensity=p.hemiIntensity;}
 if(key){key.color.set(p.key);key.intensity=p.keyIntensity;}
 let fill=null,rim=null;
 if(createFill){fill=new DirectionalLight(p.fill,p.fillIntensity);fill.position.set(34,28,-42);scene.add(fill);}
 if(createRim){rim=new DirectionalLight(p.rim,p.rimIntensity);rim.position.set(-28,24,-36);scene.add(rim);}
 return{preset:p,hemi,key,fill,rim};
}

export function gradeVillageMaterial(material,{colorScale=1,roughnessFloor=.58,metalnessCeiling=.18}={}){
 if(!material||!material.isMaterial)return material;
 const next=material.clone();
 if(next.color&&Number.isFinite(colorScale))next.color.multiplyScalar(colorScale);
 if(Number.isFinite(next.roughness))next.roughness=Math.max(roughnessFloor,next.roughness);
 if(Number.isFinite(next.metalness))next.metalness=Math.min(metalnessCeiling,next.metalness);
 return next;
}
