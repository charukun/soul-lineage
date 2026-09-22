import { angleDelta, clamp, finite, normalizeAngle, radians } from './camera/math.js';

// Left/right are ANATOMICAL: this repository's +Z-forward rig has left on +X.
export const CHARACTER_VIEWS = Object.freeze([
  'front', 'frontQuarterLeft', 'sideLeft', 'backQuarterLeft',
  'back', 'backQuarterRight', 'sideRight', 'frontQuarterRight',
]);
const STEP = Math.PI / 4;
export const viewYaw = view => {
  const index = CHARACTER_VIEWS.indexOf(view);
  return index < 0 ? 0 : normalizeAngle(index * STEP);
};
export function presentationAnchor(yaw, currentYaw, hysteresis = radians(7)) {
  if (Number.isFinite(currentYaw) && Math.abs(angleDelta(currentYaw, yaw)) <= STEP / 2 + hysteresis) return currentYaw;
  return normalizeAngle(Math.round(normalizeAngle(yaw) / STEP) * STEP);
}

/**
 * Pure view ownership reducer: no Object3D, billboard, yaw mutation or texture load.
 * A sector owns its full half-width + a boundary dead zone + hysteresis buffer.
 * Zero horizontal separation, action locks and dt=0 preserve stable ownership.
 */
export function resolveCharacterView({ cameraPosition, actorPosition, actorYaw = 0,
  currentView, state, dt = 0, deadZone = radians(2), hysteresis = radians(5),
  transitionDuration = .16, actionState } = {}) {
  const current = CHARACTER_VIEWS.includes(state?.currentView) ? state.currentView : currentView;
  const known = CHARACTER_VIEWS.includes(current);
  const dx = finite(cameraPosition?.x) - finite(actorPosition?.x), dz = finite(cameraPosition?.z) - finite(actorPosition?.z);
  const degenerate = Math.hypot(dx, dz) < .0001;
  const relativeYaw = degenerate ? finite(state?.relativeYaw, viewYaw(current)) : normalizeAngle(Math.atan2(dx, dz) - finite(actorYaw));
  const nearest = CHARACTER_VIEWS[((Math.round(relativeYaw / STEP) % 8) + 8) % 8];
  const retain = known && (degenerate || actionState?.lockView === true ||
    Math.abs(angleDelta(viewYaw(current), relativeYaw)) <= STEP / 2 + clamp(finite(deadZone), 0, STEP / 4) + clamp(finite(hysteresis), 0, STEP / 4));
  const next = retain ? current : nearest;
  const changed = known && current !== next;
  const progress = changed ? 0 : known ? clamp(finite(state?.transitionProgress, 1) + Math.max(0, finite(dt)) / Math.max(.001, finite(transitionDuration, .16)), 0, 1) : 1;
  return {
    relativeYaw, currentView: next, previousView: changed ? current : (state?.previousView || next),
    nextView: next, transitionProgress: progress, stable: !changed && progress === 1,
  };
}

/** Existing five-slot Character25D schema adapter. Never silently mirror asymmetric art. */
export function character25DAppearanceRequest(viewState) {
  const name = viewState?.currentView || 'front';
  return { view: name.replace(/Left$|Right$/, ''), side: name.endsWith('Left') ? 'left' : name.endsWith('Right') ? 'right' : null,
    mirror: false, previousView: viewState?.previousView || name, transitionProgress: viewState?.transitionProgress ?? 1 };
}
