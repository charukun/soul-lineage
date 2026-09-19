import {reviewVfxAssetFrom,reviewVfxEffectFrom} from './review-vfx-multisource.js';

export const EFFEKSEER_EXAMPLES_SOURCE=Object.freeze({
  namespace:'effekseer-examples',repository:'effekseer/Effekseer',revision:'82b37081a302b9f9eff0bf14dc6c845fca8c3c54',
  license:'MIT',licensePath:'LICENSE',licenseBlob:'c7c0094a9a163d8013086a42b3dcb3a46f984cb1',licenseBytes:1084,
});
const asset=(sourcePath,byteLength,gitBlobSha,reviewLibrary=false)=>reviewVfxAssetFrom(EFFEKSEER_EXAMPLES_SOURCE,{sourcePath,byteLength,gitBlobSha,reviewLibrary});
const effect=(id,sourcePath)=>reviewVfxEffectFrom(EFFEKSEER_EXAMPLES_SOURCE,id,sourcePath,'Effekseer');

export const EFFEKSEER_EXAMPLES_ASSETS=Object.freeze([
  asset("Examples/Resources/GpuParticles_emit_line.efkefc",3818,"65a38535ecc96719fc233c748a31450f182f27e1",true),
  asset("Examples/Resources/GpuParticles_emit_mesh.efkefc",3667,"803210f0bb4522ef0000b06e3bd951c7e38fbfd9",true),
  asset("Examples/Resources/GpuParticles_emit_sphere.efkefc",3777,"a3f00feb7b3c1353790ecc65315413beb86ad2aa",true),
  asset("Examples/Resources/GpuParticles_force_turbulence.efkefc",3325,"b3e0e48d21a43377ef391f1bcf719dfe18e3d966",true),
  asset("Examples/Resources/GpuParticles_force_vortex.efkefc",3366,"0868abf5e7b4e5fa55a3559846c8348d9587d7cb",true),
  asset("Examples/Resources/GpuParticles_sprite_gradient.efkefc",3437,"39dd99ead0d807d19ba4bd646d2a15b47354d96e",true),
  asset("Examples/Resources/GpuParticles_sprite_mass.efkefc",3505,"d35cb8fc2d5ce485f3fa96186c94710e77a12a8f",true),
  asset("Examples/Resources/GpuParticles_trails_simple.efkefc",3597,"94a552066e56d14ba94d136b61d256c95679d470",true),
  asset("Examples/Resources/Laser01.efkefc",8308,"80681d6dcc1ab4ea2bb8e105f39cbede553985de",true),
  asset("Examples/Resources/Model/Cube.efkmodel",1608,"35c8bdba3e8e4a53e60ab1f472c7576d58539508",false),
  asset("Examples/Resources/Sound/Laser.wav",12787,"65261fee66c4ce325affcfc39cff8c2e46fa9245",false),
  asset("Examples/Resources/Texture/Burst01.png",130,"d10b253fbf4773dca0729efe6920b50fc51a6eac",false),
  asset("Examples/Resources/Texture/Cloud01.png",130,"b7735ff20293b3df0930722cde17e5d18b4c4361",false),
  asset("Examples/Resources/Texture/Flame01.png",130,"fad8d1781fa11bd293f788b343a1b4765c1c247d",false),
  asset("Examples/Resources/Texture/LaserMain01.png",129,"ab36ecb16c9c2fbd61568e4f08885f1db71ea582",false),
  asset("Examples/Resources/Texture/LaserMain02.png",129,"fef9517269f4438415dd8db9fc0730f26de2f237",false),
  asset("Examples/Resources/Texture/Normal1.png",131,"db483be5249d8de682ebb54ce2e30271435e6635",false),
  asset("Examples/Resources/Texture/Particle01.png",129,"a43329949d7636804239bcbbf8ffea0bd57c8e19",false),
  asset("Examples/Resources/Texture/Particle02.png",129,"e2052482c25604087bc0be3ddd51f92500f2e845",false),
  asset("Examples/Resources/Texture/Particle03.png",130,"8532c732005fba4b2bbb849f6a4e6a033b488637",false),
  asset("Examples/Resources/Texture/Particle04_bokashi_hard.png",130,"aaf540cf996266df75d2ec0a284a7ece1b501377",false),
  asset("Examples/Resources/Texture/Particle04_bokashi_soft.png",130,"31f7a948f87a002f09eb5917b571f8607c13104d",false),
  asset("Examples/Resources/Texture/Particle04_bokashistrong_hard.png",130,"9ab4b2fddd22ef716c262d68bd26ab22485fa2d3",false),
  asset("Examples/Resources/Texture/Particle04_bokashistrong_soft.png",130,"ee1a7164eec1b8a8aa15fd6f188eaa34e3a2c90f",false),
  asset("Examples/Resources/Texture/Particle04_clear_hard.png",130,"1a7033434c267d263851dc3eef5a48a6c7c1c34d",false),
  asset("Examples/Resources/Texture/Particle04_clear_soft.png",130,"c11617b2f777c6f211233a2acd5c5655e6806889",false),
  asset("Examples/Resources/Texture/Ring01.png",128,"f07221426261553a41a9b5d93cb230693cfda573",false),
  asset("Examples/Resources/Texture/Splash01.png",130,"0674a5021aa1b2c2b2f8472d7261df46fb84053b",false),
  asset("Examples/Resources/Texture/SwordLine01.png",129,"bf589b4f66951d93379be766850b3a1ae97ed188",false),
  asset("Examples/Resources/Texture/Thunder01.png",130,"84eb0f172a9bcd3c1bea53708d7c8b9ea6c47c37",false),
  asset("Examples/Resources/Texture/Wind01.png",130,"6097a4cdd6bb7aba831b304d058db728cdbceda0",false),
  asset("Examples/Resources/Texture/wind02.png",130,"f17a0a57fbdef1c8a402b46a23aa5a98e9789e23",false),
  asset("Examples/Resources/TriggerLaser.efkefc",13245,"c1c737b411393170326fdfcb5e818540aadf56a9",true),
]);
export const EFFEKSEER_EXAMPLES_EFFECTS=Object.freeze([
  effect("lib-effekseer-gpuparticles-emit-line","Examples/Resources/GpuParticles_emit_line.efkefc"),
  effect("lib-effekseer-gpuparticles-emit-mesh","Examples/Resources/GpuParticles_emit_mesh.efkefc"),
  effect("lib-effekseer-gpuparticles-emit-sphere","Examples/Resources/GpuParticles_emit_sphere.efkefc"),
  effect("lib-effekseer-gpuparticles-force-turbulence","Examples/Resources/GpuParticles_force_turbulence.efkefc"),
  effect("lib-effekseer-gpuparticles-force-vortex","Examples/Resources/GpuParticles_force_vortex.efkefc"),
  effect("lib-effekseer-gpuparticles-sprite-gradient","Examples/Resources/GpuParticles_sprite_gradient.efkefc"),
  effect("lib-effekseer-gpuparticles-sprite-mass","Examples/Resources/GpuParticles_sprite_mass.efkefc"),
  effect("lib-effekseer-gpuparticles-trails-simple","Examples/Resources/GpuParticles_trails_simple.efkefc"),
  effect("lib-effekseer-laser01","Examples/Resources/Laser01.efkefc"),
  effect("lib-effekseer-triggerlaser","Examples/Resources/TriggerLaser.efkefc"),
]);
