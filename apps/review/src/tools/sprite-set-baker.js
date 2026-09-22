// Offline authoring tool. Not imported by the Playground or RINNE runtime.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SPRITE_SET_SCHEMA,SPRITE_SET_BUNDLE_SCHEMA,SPRITE_SET_DIRECTIONS,SPRITE_SET_ACTIONS,assertCharacterSpriteSet} from '@soul/assets/character-sprite-set';
import {spriteSetDigest} from '@soul/assets/character-sprite-set/browser';
const CLIPS={idle:/idle/i,walk:/walking|walk/i,run:/running|run/i,turn:/turn/i,attack:/1h.*melee.*chop|melee.*attack|punch/i,hit:/hit|damage/i,talk:/talk|wave/i,pickup:/pick.*up/i,rest:/sitting|sit|rest/i,jump:/jump.*start|jump/i,fall:/jump.*idle|fall/i,vault:/vault/i,climb:/climb/i};
const LOOP=new Set(['idle','walk','run','talk','rest','fall','climb']);
const EVENTS={idle:[[4,'breath']],walk:[[2,'footstep'],[6,'footstep']],run:[[1,'footstep'],[5,'footstep']],turn:[[4,'pivot']],attack:[[3,'strike']],hit:[[1,'impact']],talk:[[2,'voice']],pickup:[[4,'pick']],rest:[[4,'exhale']],jump:[[0,'takeoff']],fall:[[7,'landingHint']],vault:[[3,'clearanceHint']],climb:[[2,'grip'],[6,'grip']]};
const normalize=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
export async function bakeKnightSpriteSet(sourceURL){
  const response=await fetch(sourceURL);if(!response.ok)throw new Error('Sample GLB missing');const bytes=await response.arrayBuffer();
  const header=new TextEncoder().encode(`blob ${bytes.byteLength}\0`),gitBytes=new Uint8Array(header.length+bytes.byteLength);gitBytes.set(header);gitBytes.set(new Uint8Array(bytes),header.length);
  const gitHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',gitBytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(gitHash!=='717b56ca2b5ff5392679774725201ba03a3eefab'||bytes.byteLength!==3659532)throw new Error('Pinned Knight source integrity mismatch');
  const sourceHash=await spriteSetDigest(bytes),gltf=await new GLTFLoader().parseAsync(bytes,new URL('.',sourceURL).href),model=gltf.scene;
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(128,144);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.add(model);scene.add(new THREE.HemisphereLight(0xffffff,0x6f7779,2.3));const light=new THREE.DirectionalLight(0xfff3df,2.6);scene.add(light);
  const worldHeight=2.2,worldWidth=worldHeight*128/144,pivot=[.5,.94],camera=new THREE.OrthographicCamera(-worldWidth/2,worldWidth/2,worldHeight*pivot[1],-worldHeight*(1-pivot[1]),.01,30);
  const initialBox=new THREE.Box3().setFromObject(model);model.scale.multiplyScalar(1.65/initialBox.getSize(new THREE.Vector3()).y);model.updateMatrixWorld(true);model.position.y-=new THREE.Box3().setFromObject(model).min.y;
  const bones=[];model.traverse(node=>{if(node.isBone)bones.push(node);if(node.isMesh&&/sword|shield|weapon|axe|bow/i.test(node.name))node.visible=false;});
  const bone=alias=>bones.find(b=>normalize(b.name)===normalize(alias))||bones.find(b=>normalize(b.name).endsWith(normalize(alias)));
  const hands={rightHand:bone('hand.r'),leftHand:bone('hand.l'),body:bone('hips')};
  if(!hands.rightHand||!hands.leftHand||!hands.body)throw new Error('Knight hand/body anchors are missing');
  const rest=bones.map(b=>({position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()})),basePosition=model.position.clone(),mixer=new THREE.AnimationMixer(model),axis=new THREE.Vector3(),rotation=new THREE.Quaternion();
  function bend(name,x=0,y=0,z=0){const b=bone(name);if(!b)return;for(const [a,v] of [[0,x],[1,y],[2,z]])if(v){axis.set(a===0?1:0,a===1?1:0,a===2?1:0);rotation.setFromAxisAngle(axis,v);b.quaternion.multiply(rotation);}}
  function fallback(action,t){
    const p=t*Math.PI*2,s=Math.sin(p),beat=Math.sin(Math.PI*t);
    bend('upperarm.l',0,0,.15);bend('upperarm.r',0,0,-.15);
    if(action==='idle')bend('spine',.025*s);
    if(action==='walk'||action==='run'){const a=action==='run'?.95:.55;bend('upperleg.l',a*s);bend('upperleg.r',-a*s);bend('lowerleg.l',Math.max(0,-s)*.6);bend('lowerleg.r',Math.max(0,s)*.6);bend('upperarm.l',-a*s*.7);bend('upperarm.r',a*s*.7);}
    if(action==='turn'){bend('hips',0,.65*Math.sin(Math.PI*(t-.5)));bend('head',0,.45*Math.sin(Math.PI*(t-.5)));}
    if(action==='attack'){bend('upperarm.r',-1.2+1.9*t,0,-.5*beat);bend('lowerarm.r',-.9*beat);bend('spine',0,.55*Math.sin(Math.PI*(t-.5)));}
    if(action==='hit'){bend('spine',-.35*beat,0,.25*beat);bend('head',-.25*beat);}
    if(action==='talk'){bend('upperarm.r',-.65,0,-.5);bend('lowerarm.r',-.7-.4*s);bend('head',.08*s,.15*s);}
    if(action==='pickup'){bend('spine',.8*beat);bend('upperleg.l',-.5*beat);bend('upperleg.r',-.5*beat);bend('lowerleg.l',.8*beat);bend('lowerleg.r',.8*beat);bend('upperarm.r',-.9*beat);}
    if(action==='rest'){bend('upperleg.l',-1.1);bend('upperleg.r',-1.1);bend('lowerleg.l',1.4);bend('lowerleg.r',1.4);bend('spine',.2+.02*s);}
    if(action==='jump'){bend('upperleg.l',-.6*beat);bend('upperleg.r',-.6*beat);bend('lowerleg.l',.9*beat);bend('lowerleg.r',.9*beat);bend('upperarm.l',-1.2*beat);bend('upperarm.r',-1.2*beat);}
    if(action==='fall'){bend('upperarm.l',0,0,.65);bend('upperarm.r',0,0,-.65);bend('upperleg.l',-.3);bend('lowerleg.r',.45);}
    if(action==='vault'){bend('spine',.8*beat);bend('upperarm.l',-1.4*beat);bend('upperarm.r',-1.4*beat);bend('upperleg.l',-1.2*beat);bend('lowerleg.r',1.1*beat);}
    if(action==='climb'){bend('upperarm.l',-1.8-.45*s);bend('upperarm.r',-1.8+.45*s);bend('upperleg.l',-.45-.35*s);bend('upperleg.r',-.45+.35*s);bend('lowerleg.l',.7);bend('lowerleg.r',.7);}
  }
  const manifest={schema:SPRITE_SET_SCHEMA,id:'rinne.sample.knight.sprite-set.v1',label:'騎士・規格検証用',revision:1,stage:'local-draft',directions:[...SPRITE_SET_DIRECTIONS],render:{frameSize:[128,144],worldHeight,pivot,shadowRadius:.28,shadowAnchor:[0,0,0],occlusionCategory:'character'},assets:{},actions:{},anchors:{},approval:{productionApproved:false},provenance:{schemaVersion:1,originalSourceSha256:sourceHash,author:'Kay Lousberg / KayKit',license:'CC0-1.0',rightsState:'verified',sourceRepository:'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',sourceRevision:'672074b73ba276876a19e8816ecdc5241817ab47',sourceGitBlob:gitHash,derivedProcessing:['Offline Three.js raster bake v1; 128x144; 8 directions x 8 frames per action','Body only; no baked contact shadow or equipped weapon','Existing clips when available; explicitly recorded authored skeletal fallback otherwise','Technical local-draft fixture, not human art approval']}};
  const images={},point=new THREE.Vector3(),right=new THREE.Vector3(),normal=new THREE.Vector3();
  try{
    for(const action of SPRITE_SET_ACTIONS){
      const sheet=document.createElement('canvas');sheet.width=128*8;sheet.height=144*8;const ctx=sheet.getContext('2d');
      const clip=gltf.animations.find(c=>CLIPS[action].test(c.name)),anchors={};
      for(let row=0;row<8;row++){
        const angle=row*Math.PI/4;camera.position.set(Math.sin(angle)*6,0,Math.cos(angle)*6);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);light.position.set(Math.sin(angle-.6)*4,5,Math.cos(angle-.6)*4);right.set(Math.cos(angle),0,-Math.sin(angle));normal.set(Math.sin(angle),0,Math.cos(angle));anchors[SPRITE_SET_DIRECTIONS[row]]=[];
        for(let frame=0;frame<8;frame++){
          mixer.stopAllAction();bones.forEach((b,i)=>{b.position.copy(rest[i].position);b.quaternion.copy(rest[i].quaternion);b.scale.copy(rest[i].scale);});model.position.copy(basePosition);
          const phase=LOOP.has(action)?frame/8:frame/7;
          if(clip){const animation=mixer.clipAction(clip);animation.reset();animation.setLoop(THREE.LoopOnce,1);animation.clampWhenFinished=true;animation.play();mixer.setTime(Math.min(phase,.999)*clip.duration);}
          else {const idle=gltf.animations.find(c=>/idle/i.test(c.name));if(idle){mixer.clipAction(idle).reset().play();mixer.setTime(0);}fallback(action,phase);}
          model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);model.position.y-=box.min.y;model.updateMatrixWorld(true);
          renderer.render(scene,camera);ctx.drawImage(renderer.domElement,frame*128,row*144);
          const positions={};for(const [key,b] of Object.entries(hands)){b.getWorldPosition(point);positions[key]=[.5+point.dot(right)/worldWidth,pivot[1]-point.y/worldHeight,point.dot(normal)/worldHeight];}
          for(const key of ['weapon','weaponHitbox','trailOrigin','heldItem'])positions[key]=[...positions.rightHand];positions.secondaryGrip=[...positions.leftHand];anchors[SPRITE_SET_DIRECTIONS[row]].push(positions);
        }
      }
      const blob=await new Promise((resolve,reject)=>sheet.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));
      const sha256=await spriteSetDigest(await blob.arrayBuffer());images[action]=sheet.toDataURL('image/png');
      manifest.assets[action]={file:action+'.png',sha256,byteLength:blob.size,width:sheet.width,height:sheet.height,mediaType:'image/png',hasTransparency:true,provenance:{originalSourceSha256:sourceHash,importedFileSha256:sha256,processing:['sprite-set-baker/v1',clip?'source clip: '+clip.name:'authored skeletal fallback: '+action]}};
      manifest.actions[action]={asset:action,rows:8,columns:8,fps:action==='run'?12:8,directionOrder:[...SPRITE_SET_DIRECTIONS],loop:LOOP.has(action),oneShot:!LOOP.has(action),events:EVENTS[action].map(([frame,name])=>({frame,name})),anchors,travelHint:action==='walk'?[0,0,1.6]:action==='run'?[0,0,3.4]:[0,0,0]};
      sheet.width=sheet.height=1;
    }
    manifest.anchors=structuredClone(manifest.actions.idle.anchors.front[0]);assertCharacterSpriteSet(manifest,{playable:true});
    return {schema:SPRITE_SET_BUNDLE_SCHEMA,manifest,images};
  }finally{
    mixer.stopAllAction();mixer.uncacheRoot(model);const textures=new Set();model.traverse(node=>{node.geometry?.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}});for(const texture of textures)texture.dispose();renderer.dispose();
  }
}
