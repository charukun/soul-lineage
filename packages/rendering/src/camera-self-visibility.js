/** Render-scoped self-occlusion control; actor transforms/equipment are untouched. */
export function createCameraSelfVisibility() {
  let hidden = [];
  const restore = () => { for (const [root, visible] of hidden) root.visible = visible; hidden = []; };
  return {
    apply(roots, presentation, subject) {
      restore();
      if (presentation?.selfVisibility !== 'firstPerson' || !subject?.position) return false;
      const p = presentation.position, a = subject.position;
      if (Math.hypot(p.x - a.x, p.z - a.z) > Math.max(.3, (subject.radius || .3) * 1.5) || p.y < a.y || p.y > a.y + subject.height + .2) return false;
      for (const root of new Set(roots.filter(Boolean))) { hidden.push([root, root.visible]); root.visible = false; }
      return true;
    },
    restore,
    dispose: restore,
  };
}
