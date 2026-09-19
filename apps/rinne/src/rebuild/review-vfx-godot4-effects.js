import {GODOT4_DEMO_SOURCE as SOURCE} from './review-vfx-additional-sources.js';
import {reviewVfxEffectFrom as effectFrom} from './review-vfx-multisource.js';
const effect=(id,sourcePath)=>effectFrom(SOURCE,id,sourcePath,'Effekseer');
export const REVIEW_VFX_GODOT4_EFFECTS=Object.freeze([
  effect("lib-godot4-particles","Demo/effects/samples/Particles.efkefc"),
  effect("lib-godot4-plane","Demo/effects/samples/Plane.efkefc"),
  effect("lib-godot4-turbulence-particles","Demo/effects/samples/Simple_Turbulence_Particles.efkefc"),
  effect("lib-godot4-polar-coords","Demo/effects/sample-material1/PolarCoords.efkefc"),
  effect("lib-godot4-ramp-map","Demo/effects/sample-material1/RampMap.efkefc"),
  effect("lib-godot4-unlit","Demo/effects/sample-material1/Unlit.efkefc"),
  effect("lib-godot4-fire-projectile","Demo/effects/sample-material3/ef_fire01_projectile.efkefc"),
  effect("lib-godot4-barrior01","Demo/effects/effect-materials/ef_barrior01.efkefc"),
  effect("lib-godot4-trigger-laser","Demo/effects/samples/TriggerLaser.efkefc"),
  effect("lib-godot4-laser-soft-particle","Demo/effects/samples/Laser01_SoftParticle.efkefc"),
  effect("lib-godot4-laser-sound","Demo/effects/samples/Laser01_Sound.efkefc"),
  effect("lib-godot4-alpha-cutoff","Demo/effects/sample-material1/AlphaCutoff.efkefc"),
  effect("lib-godot4-dissolve","Demo/effects/sample-material1/Dissolve.efkefc"),
  effect("lib-godot4-falloff","Demo/effects/sample-material1/Falloff.efkefc"),
  effect("lib-godot4-image-distortion","Demo/effects/sample-material1/ImageDistortion.efkefc"),
  effect("lib-godot4-gradient","Demo/effects/tests/17/Gradient.efkefc"),
]);
