import { installAuthoredStylizedLOD } from '@soul/rendering/authored-lod';
import { NightView } from './web/view.js';

const build = NightView.prototype.build;
if (typeof build === 'function' && !build.__authoredStylizedLOD) {
  const wrapped = function authoredDemonLOD(...args) {
    const result = build.apply(this,args);
    for (const child of this.environment?.children || []) installAuthoredStylizedLOD(child,'environment');
    return result;
  };
  wrapped.__authoredStylizedLOD = true;
  NightView.prototype.build = wrapped;
}
