import { installAuthoredStylizedLOD } from '@soul/rendering/authored-lod';
import { View } from './web/view.js';
import { visualSceneTrackerFor } from './visual-scene-tracker.js';

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
    if(result?.changed!==false)installTree({children:result?.addedRoots||[this.objects,this.inside]});
    const tracker=visualSceneTrackerFor(this);
    if(this.__authoredOutsideRevision!==tracker.revision(this.outside)){
      installTree(this.outside);this.__authoredOutsideRevision=tracker.revision(this.outside);
    }
    return result;
  };
  wrapped.__authoredStylizedLOD = true;
  View.prototype.rebuild = wrapped;
}
