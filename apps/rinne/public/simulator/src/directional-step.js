/**
 * Directional review travel for the 30-second score.
 *
 * Public reference data / behavior used here:
 * - The repo's already-audited Quaternius bundle comes from the public
 *   norio/vrm-game-starter repository at an immutable revision.
 * - Current Quaternius guidance exposes eight-direction locomotion; its
 *   2026-06-16 update gives movement root motion and synchronizes directional
 *   steps so every direction starts on the left foot.
 *
 * We do not add another external animation binary. The game controller remains
 * owner of collision/root movement; this module turns those pinned reference
 * facts into a deterministic step phase/travel curve shared by compact and
 * humanoid review actors.
 */
export const DIRECTIONAL_STEP_REVISION='directional-step-1';
export const DIRECTIONAL_STEP_REFERENCE=Object.freeze({
  repository:'norio/vrm-game-starter',
  repositoryRevision:'b14c236fd8150855348ad085b7820c298eac4b30',
  repositoryPath:'src/assets/AnimationLibrary.glb',
  repositoryBlob:'8ce67624ba3bb4d2ca20a4ac188fe38ceaaab97e',
  guidanceRepository:'J-Ponzo/gltf-universal-animation-library',
  guidanceRevision:'e24c23cf2a1323488a3faa226ea7ea21f644b73e',
  upstream:'Quaternius Universal Animation Library',
  upstreamUpdate:'2026-06-16',
  license:'CC0-1.0',
  adopted:Object.freeze(['eight-direction locomotion','root-motion ownership','left-foot synchronized directional starts'])
});

const clamp=x=>Math.min(1,Math.max(0,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const STEP_PHASES=Object.freeze({load:.14,push:.36,plant:.70,settle:1});

export function classifyDirectionalStep(event){
  if(event?.step)return event.step;
  const dx=(event?.to?.[0]??0)-(event?.from?.[0]??0),dz=(event?.to?.[1]??0)-(event?.from?.[1]??0),yaw=event?.yaw??0;
  const side=dx*Math.cos(yaw)-dz*Math.sin(yaw),forward=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  if(Math.abs(side)>Math.abs(forward)*.72)return side>0?'side-left':'side-right';
  if(forward<-.05)return side>.05?'back-left':side<-.05?'back-right':'back';
  return side>.08?'forward-left':side<-.08?'forward-right':'forward';
}

function travelAt(p){
  p=clamp(p);
  if(p<=STEP_PHASES.load)return 0;
  if(p<=STEP_PHASES.push)return .58*smooth((p-STEP_PHASES.load)/(STEP_PHASES.push-STEP_PHASES.load));
  if(p<=STEP_PHASES.plant)return .58+.36*smooth((p-STEP_PHASES.push)/(STEP_PHASES.plant-STEP_PHASES.push));
  return .94+.06*smooth((p-STEP_PHASES.plant)/(STEP_PHASES.settle-STEP_PHASES.plant));
}

export function sampleDirectionalStep(event,p){
  p=clamp(p);const kind=classifyDirectionalStep(event),travel=travelAt(p),h=1e-4,lo=Math.max(0,p-h),hi=Math.min(1,p+h);
  const derivative=hi>lo?(travelAt(hi)-travelAt(lo))/(hi-lo):0;
  const load=Math.sin(Math.PI*clamp(p/STEP_PHASES.push));
  const land=Math.sin(Math.PI*clamp((p-STEP_PHASES.push)/(1-STEP_PHASES.push)));
  const lateral=kind.includes('side')||kind.includes('left')||kind.includes('right');
  const backward=kind.startsWith('back');
  return Object.freeze({
    kind,leadFoot:'left',travel,derivative,
    pelvisY:-.055*load+.025*land,
    lean:(backward?-.12:lateral?.08:.05)*Math.sin(Math.PI*p),
    phase:p<STEP_PHASES.load?'load':p<STEP_PHASES.push?'push':p<STEP_PHASES.plant?'plant':'settle'
  });
}
