import {RESOURCE_DATA_CURRENT_SOURCE as SOURCE} from './review-vfx-additional-sources.js';
import {reviewVfxAssetFrom as assetFrom} from './review-vfx-multisource.js';
const asset=(sourcePath,byteLength,gitBlobSha,reviewLibrary=false)=>assetFrom(SOURCE,{sourcePath,byteLength,gitBlobSha,reviewLibrary});
export const REVIEW_VFX_RESOURCE_DATA_ASSETS=Object.freeze([
  asset("samples/00_Basic/Simple_Turbulence_Fireworks.efkefc",4036,"0c2dcb26c6e1889d54c7930bee89bb7c4fd3b723",true),
  asset("samples/00_Version16/Aura01.efkefc",9351,"5eb9d97f2686683a0af1ff3ef91e54acf8199860",true),
  asset("samples/00_Version16/Barrior01.efkefc",9034,"dd32e8074f49fad63399998910bfdc83544cf07f",true),
  asset("samples/00_Version16/Barrior02.efkefc",11564,"74734f1649cb7cf228e14272c04965aafb3846b4",true),
  asset("samples/00_Version16/Barrior03.efkefc",3584,"7e423344cd0891bdb76fb81733952c8a2c5b3169",true),
  asset("samples/00_Version16/ForceFieldTornado.efkefc",2396,"62e63b66c2de99f1614548dbd2433d853f397b27",true),
  asset("samples/00_Basic/Texture/Particle01.png",7082,"ce5ae5e9d0c3561f47e419b9f2b5fa5e1676f344",false),
  asset("samples/00_Basic/Texture/Particle02.png",7230,"88b7fb3396201caacc73312e1241c8edd8f92881",false),
  asset("samples/00_Version16/Textures/Aura01_T.png",90119,"1658e7478d8cc7602d302daab94f5183a852750e",false),
  asset("samples/00_Version16/Textures/Aura02_T.png",107569,"c462899bc91f0da500f286f30645dcd74e1758c9",false),
  asset("samples/00_Version16/Textures/Aura04_T.png",65972,"d382c4c537eae3673e3556ac8523d0f269a89bc7",false),
  asset("samples/00_Version16/Textures/Aura06_T.png",279121,"b647fafe7a5ef990b4ab25fa9fe3e7b7bfc0f927",false),
  asset("samples/00_Version16/Textures/Gradation_Black_White_Black_Large.png",2836,"6285c36fc6978981d32cbdabede9b3916673bb9c",false),
  asset("samples/00_Version16/Textures/Normal01.png",1420731,"c88973cc029413b48854b5977a783d589476d5bc",false),
  asset("samples/00_Version16/Textures/Particle01.png",7414,"d3136b3ec0d7a7a81a5d87e7659d65b542e397e0",false),
  asset("samples/00_Version16/Textures/ShapePattern01_T.png",8138,"87abbc48146042959475046e1188ab83a5c1ad3b",false),
]);
