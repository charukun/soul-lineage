import {createReviewRoutes,mountReviewShell,mountReviewStageControls} from '@soul/shared-ui/review-shell';

const REVIEW_HOME='https://soul-lineage-review-dev.c-okamoto.workers.dev/';
const routes=createReviewRoutes({
  rinneBase:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',
  charactersBase:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/',
});

export function mountRinneReviewShell(current){
  const mounted=mountReviewShell({current,routes,homeHref:REVIEW_HOME,historyBack:true});
  const stageControls=mountReviewStageControls();
  if(mounted||stageControls)window.addEventListener('pagehide',()=>{stageControls?.destroy();mounted?.destroy();},{once:true});
  return mounted;
}
