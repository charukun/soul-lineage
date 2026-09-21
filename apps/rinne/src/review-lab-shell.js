import {createReviewRoutes,mountReviewShell,mountReviewStageControls} from '@soul/shared-ui/review-shell';
const routes=createReviewRoutes({rinneBase:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',charactersBase:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/'});
const STAGE_CONTROL_GROUPS=Object.freeze({
  motion:['.motion-camera-strip'],
  effects:['.catalog-shell > .controls'],
  sounds:['.sound-time','.sound-actions'],
  equipment:['.asset-camera-strip'],
  objects:['.object-camera-strip','.object-camera-controls'],
  battle:['.camera-zoom','.controls .review-settings']
});
export function mountRinneReviewShell(current){
  const mounted=mountReviewShell({current,routes,homeHref:'https://soul-lineage-review-dev.c-okamoto.workers.dev/'});
  const groups=STAGE_CONTROL_GROUPS[current]||[];
  const stageControls=groups.length?mountReviewStageControls({groups,label:'表示・再生コントロール'}):null;
  if(mounted||stageControls)window.addEventListener('pagehide',()=>{stageControls?.destroy();mounted?.destroy();},{once:true});
  return mounted;
}
