/** Contact-only presentation correction. Authoritative actor movement is not modified. */
import * as T from '../vendor/three.js';
import {smooth01} from './quality-math.js';
const V=()=>new T.Vector3();
export function softReach(length, maximum, soften=.005) {
  if (!(maximum>0) || !Number.isFinite(length)) return 0;
  const s=Math.min(Math.max(soften,1e-8), maximum*.15), edge=maximum-s;
  return length<=edge ? Math.max(0,length) : edge+s*(-Math.expm1(-(length-edge)/s));
}
/** C1 continuous offset fade, with position and velocity matched on release. */
export function releaseOffset(position, velocity, elapsed, duration=.10) {
  const u=Math.min(1,Math.max(0,elapsed/duration)),u2=u*u,u3=u2*u;
  return position.clone().multiplyScalar(2*u3-3*u2+1)
    .addScaledVector(velocity,(u3-2*u2+u)*duration);
}
export function supportContactWeight(draw) { return smooth01((draw-.55)/.30); }
/** Called once per simulation clock. Sampling/render repetition never advances history.
 * Toe input is in world space. Short contact debounce and separate release thresholds
 * suppress noisy height classification. Discontinuities drop all old correction.
 */
export function footContact(previous,input,clock,eligible,{height=0,maxSpeed=1.6,commit=false}={}) {
  if (!commit || previous?.clock===clock) {
    if (!previous || previous.input.distanceTo(input)>.35) return {state:previous,target:input.clone()};
    const target=previous.locked?previous.anchor.clone():input.clone().add(releaseOffset(previous.offset,previous.offsetVelocity,clock-previous.releaseTime));
    return {state:previous,target};
  }
  const dt=previous?clock-previous.clock:0;
  if (!previous || dt<=0 || dt>.12 || previous.input.distanceTo(input)>.35) {
    const state={clock,input:input.clone(),velocity:V(),target:input.clone(),targetVelocity:V(),anchor:input.clone(),locked:false,dwell:0,offset:V(),offsetVelocity:V(),releaseTime:clock-.2};
    return {state,target:input.clone()};
  }
  const s={...previous},velocity=input.clone().sub(previous.input).multiplyScalar(1/dt);
  const speed=Math.hypot(velocity.x,velocity.z),heightError=input.y-height;
  const canEnter=eligible&&heightError<.032&&speed<maxSpeed;
  s.dwell=canEnter?previous.dwell+dt:0;
  const leave=!eligible||heightError>.055||input.distanceTo(previous.anchor)>.24;
  if (s.locked&&leave) {
    s.locked=false;s.releaseTime=clock;
    s.offset=previous.target.clone().sub(input);
    s.offsetVelocity=previous.targetVelocity.clone().sub(velocity).clampLength(0,2.5);
  } else if (!s.locked&&s.dwell>=.035&&clock-s.releaseTime>.07) {
    s.locked=true;s.anchor=input.clone();s.anchor.y=Math.max(height,s.anchor.y);
    s.offset=V();s.offsetVelocity=V();
  }
  let target=s.locked?s.anchor.clone():input.clone().add(releaseOffset(s.offset,s.offsetVelocity,clock-s.releaseTime));
  target.y=Math.max(height,target.y);
  s.clock=clock;s.input=input.clone();s.velocity=velocity;s.target=target.clone();
  s.targetVelocity=target.clone().sub(previous.target).multiplyScalar(1/dt);
  return {state:s,target};
}
