import {createReviewRoutes,mountReviewShell,mountReviewStageControls} from '@soul/shared-ui/review-shell';
const routes=createReviewRoutes({rinneBase:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',charactersBase:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/'});
const REVIEW_CONTROL_MOUNTS=Object.freeze({
  motion:{host:'.motion-controls',groups:['.motion-playback','.motion-timeline']},
  effects:{groups:['.catalog-shell > .controls']},
  sounds:{groups:['.sound-time','.sound-actions']},
  equipment:{groups:['.asset-camera-strip']},
  objects:{groups:['.object-camera-strip','.object-camera-controls']},
  battle:{groups:['.camera-zoom','.controls .review-settings']}
});
export function mountRinneReviewShell(current){
  const mounted=mountReviewShell({current,routes,homeHref:'https://soul-lineage-review-dev.c-okamoto.workers.dev/'});
  const controlMount=REVIEW_CONTROL_MOUNTS[current];
  const controlHost=controlMount?.host?document.querySelector(controlMount.host):undefined;
  const stageControls=controlMount?.groups?.length?mountReviewStageControls({stage:controlHost,groups:controlMount.groups,label:'表示・再生コントロール'}):null;
  if(mounted||stageControls)window.addEventListener('pagehide',()=>{stageControls?.destroy();mounted?.destroy();},{once:true});
  return mounted;
}
