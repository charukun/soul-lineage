import { Color, Vector4 } from 'three';
const grayBrow = new Color(.55,.55,.52);

/** A shared shader program with per-actor uniforms, applied AFTER expression morphs and
 * BEFORE skinning. Facial skin, eyelids, whites and iris use one continuous deformation;
 * no destructive geometry/morph edits, texture copies or changes to the expression rig.
 * This adapter is deliberately limited to the audited Shino face materials.
 */
export function attachFaceIdentity(actor) {
  const state = { enabled: { value: 0 }, shape: { value: new Vector4(1, 1, 1, 1) },
    eye: { value: new Vector4(1, 1, 1, 1) }, brow: { value: 0 }, hair: { value: new Color() } };
  const materials = new Set();
  actor.visual.traverse(mesh => {
    if (!mesh.isMesh || !mesh.morphTargetInfluences) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material || !/Face|Eye/i.test(material.name) || materials.has(material)) continue;
      materials.add(material);
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
      const brow = /FaceBrow/.test(material.name);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        if (!shader.vertexShader.includes('#include <morphtarget_vertex>')) throw new Error('Shino facial identity requires morph-before-skin shader');
        Object.assign(shader.uniforms, { mcIdentity: state.enabled, mcFace: state.shape, mcEye: state.eye, mcBrow: state.brow, mcBrowColor: state.hair });
        shader.vertexShader = `uniform float mcIdentity; uniform vec4 mcFace; uniform vec4 mcEye; uniform float mcBrow;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <morphtarget_vertex>', `#include <morphtarget_vertex>
if (mcIdentity > 0.5) {
  // Audited Shino bind-space landmarks in metres. All face primitives share this space.
  float mcY = (transformed.y - 1.38104236) / 0.23416734;
  float mcFront = smoothstep(-0.005, 0.045, transformed.z);
  float mcEyeBand = smoothstep(0.25, 0.34, mcY) * (1.0-smoothstep(0.50, 0.64, mcY)) * mcFront;
  float mcSide = sign(transformed.x);
  float mcCenter = mcSide * 0.044;
  float mcAway = smoothstep(0.008, 0.027, abs(transformed.x));
  transformed.x = mix(transformed.x, mcCenter * mcEye.z + (transformed.x-mcCenter) * mcEye.x, mcEyeBand * mcAway);
  transformed.y = mix(transformed.y, 1.477 + (transformed.y-1.477) * mcEye.y, mcEyeBand);
  float mcJaw = (1.0-smoothstep(0.22, 0.50, mcY)) * mcFront;
  transformed.x *= mix(1.0, mcFace.x, mcJaw);
  transformed.x *= mix(1.0, mcFace.y, smoothstep(0.18,0.31,mcY)*(1.0-smoothstep(0.38,0.53,mcY)));
  transformed.y -= (mcFace.w-1.0) * 0.07 * (1.0-smoothstep(0.0,0.32,mcY));
  float mcNose = (1.0-smoothstep(0.006,0.028,abs(transformed.x))) * smoothstep(0.13,0.26,mcY) * (1.0-smoothstep(0.35,0.47,mcY)) * mcFront;
  transformed.z += mcNose * (mcFace.z-1.0) * 0.045;
  ${brow ? 'transformed.y = 1.5116 + (transformed.y-1.5116) * mcEye.w + (abs(transformed.x)-0.044) * mcBrow;' : ''}
}`);
        if (brow) {
          shader.fragmentShader = 'uniform float mcIdentity; uniform vec3 mcBrowColor;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
if (mcIdentity > 0.5) { float mcInk = dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722)); diffuseColor.rgb = mcBrowColor * (0.5 + mcInk * 0.5); }`);
        }
      };
      material.customProgramCacheKey = () => `${key}:shino-face-identity-v1:${brow ? 'brow' : 'surface'}`;
      material.needsUpdate = true;
    }
  });
  return {
    set(identity, appearance) {
      state.enabled.value = identity ? 1 : 0;
      if (!identity) return;
      const f = identity.face;
      state.shape.value.set(f.jaw, f.cheek, f.nose, f.chin);
      state.eye.value.set(f.eyeWidth, f.eyeHeight, f.eyeSpacing, f.browWeight);
      state.brow.value = f.browSlant;
      if (appearance) state.hair.value.setRGB(...appearance.hair).multiplyScalar(identity.hairValue)
        .lerp(grayBrow, (appearance.gray ?? 0) * .7);
    },
    get materialCount() { return materials.size; }
  };
}
