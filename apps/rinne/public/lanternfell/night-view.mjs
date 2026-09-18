import * as T from 'three';
import {Renderer} from './view.mjs';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {TEXTURES,assetURL} from './assets.mjs';
// Only lighting, material adaptation and sourced sprites are authored here.
// Every solid shape and every motion clip still comes from the pinned packs.
export class NightRenderer extends Renderer{
 constructor(canvas){super(canvas);this.yaw=.14;this.pitch=.64;this.distance=19;this.lampAnchors=[];this.lightMaterials=new Map();this.atmosphere=new T.Group();this.world.add(this.atmosphere);this.world.fog=new T.Fog('#14213b',24,70);this.world.background.set('#0a1328');this.world.children.find(x=>x.isHemisphereLight).color.set('#86a4e4');this.world.children.find(x=>x.isHemisphereLight).groundColor.set('#273b48');this.world.children.find(x=>x.isHemisphereLight).intensity=.8;this.sun.color.set('#91b8ff');this.sun.intensity=1.5;this.sun.position.set(-12,24,-16);this.sun.shadow.mapSize.set(1024,1024);this.gpu.toneMappingExposure=1.08;
  this.localLights.forEach(l=>this.world.remove(l));this.localLights=Array.from({length:4},()=>new T.PointLight('#ffb775',42,14,2));this.localLights.forEach(l=>this.world.add(l));this.rim=new T.DirectionalLight('#9dbbe8',.45);this.rim.target=new T.Object3D();this.world.add(this.rim,this.rim.target);
  this.composer=new EffectComposer(this.gpu);this.composer.addPass(new RenderPass(this.world,this.camera));this.bloom=new UnrealBloomPass(new T.Vector2(256,512),.48,.65,1.05);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());this.postSize='';this.nightQuality='balanced';this.gpu.info.autoReset=false;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 }
 material(source,tint){return super.material(source,tint);}
 glowMaterial(source,kind){const key=source.uuid+':night:'+kind;if(this.lightMaterials.has(key))return this.lightMaterials.get(key);const m=source.clone();m.roughness=kind==='stone'?.32:kind==='woodFloor'?.48:.78;m.metalness=kind==='stone'?.08:0;
  if(['house','smith','tavern','lantern'].includes(kind)){m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\n#ifdef USE_MAP\n vec3 originalLight = texture2D(map, vMapUv).rgb;\n float windowMask = smoothstep(0.7,0.88,originalLight.r) * smoothstep(0.35,0.62,originalLight.g) * (1.0-smoothstep(0.68,0.86,originalLight.b)) * smoothstep(0.04,0.16,originalLight.r-originalLight.b);\n totalEmissiveRadiance += vec3(1.0,0.43,0.12) * windowMask * ${kind==='lantern'?'3.3':'1.8'};\n#endif`);};m.customProgramCacheKey=()=>`lanternfell-emissive-${kind}-v1`;}
  this.lightMaterials.set(key,m);return m;
 }
 prop(id,x,z,options={}){const adjusted={...options};if(id==='grass'&&!adjusted.tint)adjusted.tint='#547785';if(['tree','pine'].includes(id)&&!adjusted.tint)adjusted.tint='#93aaa8';const object=super.prop(id,x,z,adjusted);if(['stone','woodFloor','house','smith','tavern','lantern'].includes(id))object.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>this.glowMaterial(m,id)):this.glowMaterial(o.material,id);});if(id==='lantern'&&(!options.parent||options.parent===this.environment))this.lampAnchors.push({x,y:(options.y||0)+(options.height||2)*.91,z,color:'#ffb775'});return object;}
 sprite(texture,x,y,z,size,color,opacity){const material=new T.SpriteMaterial({map:this.textures.get(texture),color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});const s=new T.Sprite(material);s.position.set(x,y,z);s.scale.set(size,size,1);s.userData.source=assetURL(TEXTURES[texture]);this.atmosphere.add(s);return s;}
 buildScene(game){this.atmosphere.traverse(o=>o.material?.dispose());this.atmosphere.clear();this.lampAnchors=[];super.buildScene(game);
  this.glows=this.lampAnchors.map((p,i)=>{const s=this.sprite('smoke',p.x,p.y,p.z,1.8,p.color,.28);s.userData.phase=i*1.73;s.userData.base=.25;this.sprite('spark',p.x,p.y,p.z,.25,p.color,1);return s;});
  this.motes=[];if(game.scene!=='home')for(let i=0;i<26;i++){const a=i*2.399963,r=6+(i%7)*3,s=this.sprite('star',Math.cos(a)*r,.7+i%5*.45,Math.sin(a)*r,.045+(i%3)*.018,i%4?'#a5f4ee':'#ffd78c',.6);s.userData.baseY=s.position.y;s.userData.phase=a;this.motes.push(s);}
  this.focus.set(game.player.x,1,game.player.z);
 }
 decorateScene(game){
  // Additional real source torches frame the route rather than obscure its center.
  if(game.scene==='town'){for(const [x,z]of [[-3,-12],[3,-12],[-3,13],[3,13],[-9,2],[9,2]])this.prop('lantern',x,z,{height:2.4});this.lampAnchors.push({x:-12,y:2.4,z:-7.2,color:'#ffae65'},{x:12,y:2.3,z:-7.2,color:'#ffae65'},{x:0,y:2.7,z:-4,color:'#74e4e4'});}
 }
 updateLighting(game,dt){const home=game.scene==='home',ruins=game.scene==='ruins';this.world.background.set(home?'#101525':ruins?'#100f25':'#0a1328');this.world.fog.color.set(ruins?'#1b1c3d':'#14213b');this.world.fog.near=home?20:24;this.world.fog.far=home?58:70;const p=game.player,near=[...this.lampAnchors];if(home)for(const f of game.save.furniture)if(f.type==='lantern')near.push({x:f.x,y:1.3,z:f.z,color:'#ffb775'});near.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));this.localLights.forEach((l,i)=>{const source=near[i];l.visible=!!source&&i<(this.nightQuality==='low'?2:4);if(source){l.position.set(source.x,source.y+.15,source.z);l.color.set(source.color);l.intensity=(home?28:42)*(this.reducedMotion?1:1+Math.sin(this.time*2+i)*.025);}});this.rim.position.set(p.x+4,7,p.z+6);this.rim.target.position.set(p.x,1.4,p.z);
  for(const s of this.glows||[])s.material.opacity=s.userData.base*(this.reducedMotion?1:.94+.06*Math.sin(this.time*1.7+s.userData.phase));for(const s of this.motes||[]){s.visible=this.nightQuality!=='low';if(!this.reducedMotion){s.position.y=s.userData.baseY+Math.sin(this.time*.45+s.userData.phase)*.25;s.material.opacity=.3+.5*(.5+.5*Math.sin(this.time+s.userData.phase));}}
 }
 frameTarget(game,mode,build){const p=game.player,v=new T.Vector3(p.x,1,p.z);if(mode==='play'&&!build){v.x-=Math.sin(this.yaw)*2.1;v.z-=Math.cos(this.yaw)*2.1;}return v;}
 resetCamera(){this.yaw=.14;this.pitch=.64;this.distance=19;}
 drawFrame(dt){if(this.nightQuality==='low'){this.gpu.render(this.world,this.camera);return;}const w=this.canvas.clientWidth,h=this.canvas.clientHeight,ratio=Math.min(devicePixelRatio||1,this.nightQuality==='high'?1.5:1.15),key=`${w},${h},${ratio}`;if(key!==this.postSize){this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.postSize=key;}this.composer.render(dt);}
 render(game,dt,mode,creation,build){this.nightQuality=game.save.settings.quality;this.gpu.shadowMap.enabled=this.nightQuality!=='low';this.gpu.info.reset();super.render(game,dt,mode,creation,build);}
 get metrics(){return{...super.metrics,artDirection:'moonlit-village-v1',bloom:this.nightQuality!=='low',realtimeLocalLights:this.localLights.filter(l=>l.visible).length,sourcedGlows:this.glows?.length||0};}
}
