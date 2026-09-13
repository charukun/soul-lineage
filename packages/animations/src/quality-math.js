// Portable presentation math. Coordinates are metres, rotations are xyzw radians.
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const mul = (a, k) => a.map(x => x * k);
export const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
export const length = a => Math.hypot(...a);
export const unit = a => mul(a, 1 / (length(a) || 1));
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
export const smooth = t => { t = clamp(t); return t*t*(3-2*t); };
export const inverseQ = q => [-q[0], -q[1], -q[2], q[3]];
export function normalizeQ(q) {
  if (!Array.isArray(q) || q.length !== 4 || !q.every(Number.isFinite) || length(q) < 1e-8) throw new Error('Invalid quaternion');
  return unit(q);
}
export function multiplyQ(a, b) {
  const [x,y,z,w]=a,[X,Y,Z,W]=b;
  return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
}
export function rotate(a, q) { return multiplyQ(multiplyQ(q,[...a,0]),inverseQ(q)).slice(0,3); }
export const angleQ = (a, b) => 2*Math.acos(clamp(Math.abs(dot(normalizeQ(a),normalizeQ(b))),0,1));
export function slerp(a, b, t) {
  a=normalizeQ(a); b=normalizeQ(b); let d=dot(a,b); if(d<0){b=mul(b,-1);d=-d;}
  if(d>.9995)return normalizeQ(mix(a,b,clamp(t)));
  const theta=Math.acos(clamp(d,-1,1)),s=Math.sin(theta);
  return add(mul(a,Math.sin((1-clamp(t))*theta)/s),mul(b,Math.sin(clamp(t)*theta)/s));
}
export function closestOnSegment(p, a, b) {
  const ab=sub(b,a);return add(a,mul(ab,clamp(dot(sub(p,a),ab)/(dot(ab,ab)||1))));
}
export function segmentDistance(a,b,c,d) {
  // Exact closest points on finite segments, including parallel/zero-length cases.
  const u=sub(b,a),v=sub(d,c),w=sub(a,c),A=dot(u,u),B=dot(u,v),C=dot(v,v),D=dot(u,w),E=dot(v,w);
  let s=A>1e-12?clamp(-D/A):0,t=0;
  if(C>1e-12){const den=A*C-B*B;s=den>1e-12?clamp((B*E-C*D)/den):0;t=(B*s+E)/C;
    if(t<0){t=0;s=A>1e-12?clamp(-D/A):0;}else if(t>1){t=1;s=A>1e-12?clamp((B-D)/A):0;}}
  return length(sub(add(a,mul(u,s)),add(c,mul(v,t))));
}
