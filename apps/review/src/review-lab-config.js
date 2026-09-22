import {createReviewRoutes} from '@soul/shared-ui/review-shell';

export const REVIEW_DEV=Object.freeze({
  rinne:import.meta.env.DEV&&['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:5173/':'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',
  village:'https://soul-lineage-village-dev.c-okamoto.workers.dev/',
  demon:'https://soul-lineage-demon-dev.c-okamoto.workers.dev/',
  pulse:'https://rinne-ops.c-okamoto.workers.dev/',
  characters:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/',
});

export const REVIEW_ROUTES=Object.freeze({
  ...createReviewRoutes({rinneBase:REVIEW_DEV.rinne,charactersBase:REVIEW_DEV.characters}),
  hybrid25d:new URL('./review-hybrid-25d',location.href).href,
  battle2:new URL('./battle2',location.href).href,
  battlebk:new URL('./battlebk',location.href).href,
  rinne:REVIEW_DEV.rinne,
  village:REVIEW_DEV.village,
  demon:REVIEW_DEV.demon,
  pulse:REVIEW_DEV.pulse,
});

export const REVIEW_WARM_ORDER=Object.freeze(['effects','battle','battle2','motion','characters','equipment','objects','sounds']);

export const REVIEW_VFX_WARM_ASSETS=Object.freeze([
  'simulator/assets/effekseer/effekseer.js',
  'simulator/assets/effekseer/effekseer.wasm',
  'simulator/assets/effekseer/samples/00_Basic/Simple_Ribbon_Sword.efkefc',
  'simulator/assets/effekseer/samples/02_Tktk03/ToonHit.efkefc',
]);

