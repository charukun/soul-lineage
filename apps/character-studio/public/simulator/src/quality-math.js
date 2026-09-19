/** Visual contact math. No gameplay timers, damage or world movement are changed. */
import * as T from '../vendor/three.js';
const Y = new T.Vector3(0, 1, 0);
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const smooth01 = x => { x=clamp01(x); return x*x*(3-2*x); };

/** Shortest-arc swing + explicit roll: no reference-axis switch at dot=.92. */
export function stableSwingFrame(direction, roll=0) {
  const d = direction.clone();
  if (!Number.isFinite(d.lengthSq()) || d.lengthSq()<1e-12) d.copy(Y);
  d.normalize();
  return new T.Quaternion().setFromUnitVectors(Y,d)
    .multiply(new T.Quaternion().setFromAxisAngle(Y,roll)).normalize();
}

/** Right-handed, orthonormal anatomical palm basis; optional fingers may be absent. */
export function palmBasis(longitudinal, across) {
  const x=longitudinal.clone();
  if (x.lengthSq()<1e-12) x.set(1,0,0);
  x.normalize();
  let y=across.clone().addScaledVector(x,-across.dot(x));
  if (y.lengthSq()<1e-10) {
    y = Math.abs(x.y)<.85 ? new T.Vector3(0,1,0) : new T.Vector3(0,0,1);
    y.addScaledVector(x,-y.dot(x));
  }
  y.normalize();
  const z=x.clone().cross(y).normalize();
  y.copy(z).cross(x).normalize();
  return {x,y,z,rotation:new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z))};
}

/** Grip is expressed in unscaled mesh coordinates. Scale precedes inverse grip. */
export function gripMatrix(socket, spec, unit=1) {
  const scale=spec.scale/unit;
  return socket.clone().multiply(new T.Matrix4().makeScale(scale,scale,scale))
    .multiply(new T.Matrix4().makeTranslation(-spec.grip[0],-spec.grip[1],-spec.grip[2]));
}
