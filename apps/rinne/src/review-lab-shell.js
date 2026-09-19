import {createReviewRoutes,mountReviewShell} from '@soul/shared-ui/review-shell';
const routes=createReviewRoutes({rinneBase:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',charactersBase:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/'});
export function mountRinneReviewShell(current){const mounted=mountReviewShell({current,routes,homeHref:'https://soul-lineage-review-dev.c-okamoto.workers.dev/'});if(mounted)window.addEventListener('pagehide',()=>mounted.destroy(),{once:true});return mounted}
