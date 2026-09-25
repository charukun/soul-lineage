import { stylizedArtProfile } from '@soul/characters';

const clamp01=value=>Math.min(1,Math.max(0,Number.isFinite(Number(value))?Number(value):0));
const profile=(bands,toonStrength,inkStrength,rimStrength,rimPower,enabled=true)=>Object.freeze({
  bands,toonStrength,inkStrength,rimStrength,rimPower,enabled
});

/**
 * Shared RINNE render law. Characters are deliberately more graphic than the
 * world so imported GLB assets converge on one visual language without forcing
 * the environment into a flat anime look.
 */
export const STYLIZED_SHADING_PROFILES=Object.freeze({
  hero:profile(3,.86,.40,.15,3.1),
  npc:profile(3,.74,.30,.10,3.2),
  enemy:profile(3,.82,.36,.13,3.0),
  environment:profile(4,.38,.08,.025,3.6),
  prop:profile(4,.48,.14,.045,3.4),
  distant:profile(4,.18,.035,0,4.0)
});

export function stylizedShadingProfile(profileId){
  stylizedArtProfile(profileId);
  return STYLIZED_SHADING_PROFILES[profileId]||STYLIZED_SHADING_PROFILES.npc;
}

function install(material,profileId){
  if(!material?.isMeshStandardMaterial||material.userData?.soulStylizedShader)return false;
  const config=stylizedShadingProfile(profileId);
  if(!config.enabled)return false;
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey?.bind(material);
  material.userData=material.userData||{};
  const runtime=material.userData.soulStylizedRuntime||{inspiration:0};
  material.userData.soulStylizedRuntime=runtime;
  material.onBeforeCompile=shader=>{
    if(typeof previous==='function')previous(shader);
    const uniforms={
      soulToonBands:{value:config.bands},
      soulToonStrength:{value:config.toonStrength},
      soulInkStrength:{value:config.inkStrength},
      soulRimStrength:{value:config.rimStrength},
      soulRimPower:{value:config.rimPower},
      soulInspiration:{value:clamp01(runtime.inspiration)}
    };
    Object.assign(shader.uniforms,uniforms);
    material.userData.soulStylizedUniforms=uniforms;
    shader.fragmentShader=[
      'uniform float soulToonBands;',
      'uniform float soulToonStrength;',
      'uniform float soulInkStrength;',
      'uniform float soulRimStrength;',
      'uniform float soulRimPower;',
      'uniform float soulInspiration;',
      shader.fragmentShader
    ].join('\n');
    const marker='#include <lights_fragment_end>';
    if(!shader.fragmentShader.includes(marker))return;
    shader.fragmentShader=shader.fragmentShader.replace(marker,`${marker}
float soulInspirationAmount = clamp( soulInspiration, 0.0, 1.0 );
float soulEffectiveBands = max( 2.0, soulToonBands - soulInspirationAmount );
float soulBandSteps = max( 1.0, soulEffectiveBands - 1.0 );
float soulDirectLuma = dot( reflectedLight.directDiffuse, vec3( 0.2126, 0.7152, 0.0722 ) );
float soulBandInput = clamp( soulDirectLuma, 0.0, 1.0 );
float soulBandLuma = floor( soulBandInput * soulBandSteps + 0.5 ) / soulBandSteps;
float soulBandScale = soulDirectLuma > 0.0001 ? soulBandLuma / soulDirectLuma : 1.0;
float soulEffectiveStrength = mix( soulToonStrength, 1.0, soulInspirationAmount * 0.9 );
reflectedLight.directDiffuse *= mix( 1.0, clamp( soulBandScale, 0.12, 1.65 ), soulEffectiveStrength );

float soulSpecLuma = dot( reflectedLight.directSpecular, vec3( 0.2126, 0.7152, 0.0722 ) );
float soulSpecGate = smoothstep( 0.18 - soulInspirationAmount * 0.08, 0.48 - soulInspirationAmount * 0.10, soulSpecLuma );
reflectedLight.directSpecular *= mix( 1.0, soulSpecGate, soulEffectiveStrength * 0.58 );

vec3 soulView = normalize( -vViewPosition );
float soulFacing = clamp( dot( normalize( normal ), soulView ), 0.0, 1.0 );
float soulEdge = smoothstep( 0.28, 0.76, 1.0 - soulFacing );
float soulInk = clamp( soulEdge * ( soulInkStrength + soulInspirationAmount * 0.34 ), 0.0, 0.82 );
float soulInkKeep = 1.0 - soulInk;
reflectedLight.directDiffuse *= soulInkKeep;
reflectedLight.indirectDiffuse *= mix( 1.0, soulInkKeep, 0.72 );
reflectedLight.directSpecular *= soulInkKeep;

float soulPaperMix = soulInspirationAmount * 0.24;
reflectedLight.directDiffuse = mix( reflectedLight.directDiffuse, vec3( dot( reflectedLight.directDiffuse, vec3( 0.2126, 0.7152, 0.0722 ) ) ), soulPaperMix );
reflectedLight.indirectDiffuse = mix( reflectedLight.indirectDiffuse, vec3( dot( reflectedLight.indirectDiffuse, vec3( 0.2126, 0.7152, 0.0722 ) ) ), soulPaperMix * 0.72 );
reflectedLight.indirectDiffuse *= mix( 1.0, 0.72, soulInspirationAmount );

float soulRim = pow( max( 0.0, 1.0 - soulFacing ), soulRimPower );
totalEmissiveRadiance += diffuseColor.rgb * soulRim * soulRimStrength * ( 1.0 + soulInspirationAmount * 0.85 );`);
  };
  material.customProgramCacheKey=()=>`${previousKey?previousKey():''}|soul-toon-v2:${profileId}:${config.bands}:${config.toonStrength}:${config.inkStrength}:${config.rimStrength}`;
  material.userData.soulStylizedShader={profileId,...config,shaderModel:'rinne-banded-toon-v2'};
  material.needsUpdate=true;
  return true;
}

function collectInstalledMaterials(root){
  const seen=new Set();
  root?.traverse?.(node=>{
    const rows=(Array.isArray(node?.material)?node.material:[node?.material]).filter(Boolean);
    for(const material of rows)if(material.userData?.soulStylizedShader)seen.add(material);
  });
  return [...seen];
}

function applyRuntimeValue(material,value){
  material.userData=material.userData||{};
  const runtime=material.userData.soulStylizedRuntime||{};
  runtime.inspiration=value;
  material.userData.soulStylizedRuntime=runtime;
  const uniform=material.userData.soulStylizedUniforms?.soulInspiration;
  if(uniform)uniform.value=value;
}

export function applyStylizedShading(root,profileId){
  stylizedShadingProfile(profileId);
  const seen=new Set();let materials=0;
  root?.traverse?.(node=>{
    const rows=(Array.isArray(node?.material)?node.material:[node?.material]).filter(Boolean);
    for(const material of rows)if(!seen.has(material)){seen.add(material);if(install(material,profileId))materials++;}
  });
  if(root){
    root.userData=root.userData||{};
    root.userData.soulStylizedShading={profileId,shaderModel:'rinne-banded-toon-v2'};
  }
  return{profileId,materials,shaderModel:'rinne-banded-toon-v2'};
}

export function setStylizedShadingState(root,{inspiration=0}={}){
  const value=clamp01(inspiration),materials=collectInstalledMaterials(root);
  for(const material of materials)applyRuntimeValue(material,value);
  return{materials:materials.length,inspiration:value};
}

/**
 * A scene-level pulse keeps "閃き" in the renderer rather than painting a
 * detached UI flash on top. It touches uniforms only while active.
 */
export function createStylizedShadingController(root,{hold=.07,release=.34}={}){
  if(!root?.traverse)throw new Error('Stylized shading controller requires an Object3D root');
  let materials=[],active=false,elapsed=0,value=0,pulses=0,peak=1;
  const refresh=()=>{materials=collectInstalledMaterials(root);return materials.length;};
  const set=valueInput=>{
    value=clamp01(valueInput);
    for(const material of materials)applyRuntimeValue(material,value);
  };
  const clear=()=>{if(!materials.length)refresh();set(0);active=false;elapsed=0;};
  const pulse=(intensity=1)=>{
    refresh();peak=Math.max(.2,clamp01(intensity));active=true;elapsed=0;pulses++;set(peak);
    return{materials:materials.length,intensity:peak};
  };
  const update=dt=>{
    if(!active)return value;
    elapsed+=Math.max(0,Math.min(.1,Number(dt)||0));
    if(elapsed<=hold){set(peak);return value;}
    const progress=(elapsed-hold)/Math.max(.001,release);
    if(progress>=1){clear();return value;}
    const eased=(1-progress)*(1-progress);
    set(peak*eased);return value;
  };
  return{
    refresh,pulse,update,clear,
    snapshot:()=>({active,value,pulses,materials:materials.length,hold,release,shaderModel:'rinne-banded-toon-v2'}),
    dispose:clear
  };
}
