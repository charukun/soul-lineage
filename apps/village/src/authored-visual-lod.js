import { installAuthoredStylizedLOD } from '@soul/rendering/authored-lod';
import { View } from './web/view.js';

function installTree(root) {
  for (const child of root?.children || []) {
    const profileId = child.userData?.stylizedArt?.profileId;
    if (['environment','prop','distant'].includes(profileId)) installAuthoredStylizedLOD(child, profileId);
    else if (child.children?.length) installTree(child);
  }
}

const rebuild = View.prototype.rebuild;
if (typeof rebuild === 'function' && !rebuild.__authoredStylizedLOD) {
  const wrapped = function authoredVillageLOD(...args) {
    const result = rebuild.apply(this,args);
    installTree(this.objects); installTree(this.inside); installTree(this.outside);
    return result;
  };
  wrapped.__authoredStylizedLOD = true;
  View.prototype.rebuild = wrapped;
}
